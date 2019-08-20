import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const ENCRYPTION_KEY = process.env.CRYPTO_KEY;
const IV_LENGTH = 16;
/**
 * @desc encrypt github token and user_id
 * @param {String} text stringified object
 */
export function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final(), ]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * @desc decrypt token
 * returns stringified object
 * @param {String} text
 */
export function decrypt(text) {
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift(), 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final(), ]);

  return decrypted.toString();
}

/**
 * @desc add branch protection
 * wait till repo is migrated then add
 * @param {Object} octokit
 * @param {String} repo
 */
export function addBranchProtection(octokit, repo) {
  let intId = setInterval(async () => {
    const invite = await octokit
      .migrations
      .getImportProgress({
        repo,
        owner: process.env.GIT_USER
      });

    if (invite.data.status === 'complete') {
      octokit
        .repos
        .updateBranchProtection({
          repo,
          owner: process.env.GIT_USER,
          branch: 'master',
          required_pull_request_reviews: {
            require_code_owner_reviews: true,
            dismiss_stale_reviews: true,
            required_approving_review_count: 1
          },
          required_status_checks: null,
          enforce_admins: null,
          restrictions: null
        })
        .catch(console.error);
      clearInterval(intId);
    }
  }, 5000);
}
