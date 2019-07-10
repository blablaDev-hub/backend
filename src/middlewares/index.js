import Octokit from '@octokit/rest';
import dotenv from 'dotenv';
import {
  decrypt
} from './../helpers';
dotenv.config();

/**
 * @desc authenticate blablaDev-hub user
 */
export function gitHub_bbDev(req, res, next) {
  try {
    // auth for blablaDev-hub
    const bbDevGitHub = new Octokit({
      auth: process.env.GIT_TOKEN,
      previews: ['mercy-preview', 'luke-cage-preview', ]
    });

    res.locals.bbDev = bbDevGitHub;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * @desc do oAuth for bbDev user
 * @param {String} code
 */
export function gitHubUserOAuth(req, res, next) {
  const {
    code
  } = req.body;

  if (!code) {
    const err = new Error('no code');
    err.status = 401;
    return next(err);
  }

  const octo = new Octokit({});
  octo.registerEndpoints({
    login: {
      oauth: {
        method: 'POST',
        url: 'https://github.com/login/oauth/access_token',
        headers: {
          accept: 'application/json'
        },
        params: {
          client_id: {
            required: true,
            type: 'string'
          },
          client_secret: {
            required: true,
            type: 'string'
          },
          code: {
            required: true,
            type: 'string'
          }
        }
      }
    }
  });

  octo
    .login
    .oauth({
      code,
      client_id: process.env.GIT_OA_ID,
      client_secret: process.env.GIT_OA_SECRET
    })
    .then(response => {
      res.locals.auth = {
        token: response.data.access_token,
        userGitHub: new Octokit({
          auth: `token ${response.data.access_token}`
        })
      };
      next();
    })
    .catch(next);
}

/**
 * @desc check if user authenticated
 * @param {String} cookie
 */
export function checkAuth(req, res, next) {
  const {
    bbDev
  } = req.cookies;
  if (!bbDev) {
    const err = new Error('no auth');
    err.status = 401;
    return next(err);
  }

  res.cookie('bbDev', bbDev, {
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  const decoded = JSON.parse(decrypt(bbDev));
  res.locals.auth = {
    userGitHub: new Octokit({
      auth: `token ${decoded.g}`
    }),
    i: decoded.i,
    t: decoded.t
  };
  next();
}
