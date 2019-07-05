import express from 'express';
import dotenv from 'dotenv';
import DB from './../db';
import {
  gitHub_bbDev,
  checkAuth,
} from './../middlewares';
import {
  addBranchProtection
} from './../helpers';

const db = new DB();
const router = express.Router();
router.use(checkAuth);
router.use(gitHub_bbDev);
dotenv.config();

/**
 * @desc get bbDev-* projects from GitHub
 */
router.get('/', (req, res, next) => {
  const {
    bbDev
  } = res.locals;
  bbDev
    .repos
    .list({
      visibility: 'public',
      affiliation: 'owner'
    })
    .then(repos => Promise.all(repos.data.filter(r => r.name.startsWith('bbDev-'))
      .map(async r => {
        const topics = await bbDev
          .repos
          .listTopics({
            owner: process.env.GIT_USER,
            repo: r.name
          });

        return {
          id: r.id,
          name: r.name,
          description: r.description,
          html_url: r.html_url,
          topics: topics.data.names
        };
      })))
    .then(values => {
      console.log(values);
      res.send(values);
    })
    .catch(next);
});

/**
 * @desc get readme for specific repo
 */
router.get('/readme/:repo', (req, res, next) => {
  const {
    bbDev
  } = res.locals;
  const {
    repo
  } = req.params;
  if (!repo) {
    res.send({
      success: false,
      reason: 'repo not specified'
    });
    return;
  }

  bbDev
    .repos
    .getContents({
      owner: process.env.GIT_USER,
      repo,
      path: 'README.md'
    })
    .then(readme => res.send({
      name: readme.data.name,
      download_url: readme.data.download_url,
      content: readme.data.content,
      encoding: readme.data.encoding
    }))
    .catch(next);
});

/**
 * @desc fake fork of project
 * create new project on blablaDev-hub user
 * import main project
 * set user as colaborator
 * @param {String} project
 */
router.post('/start', async (req, res, next) => {
  const {
    bbDev,
    auth,
  } = res.locals;
  const {
    project
  } = req.body;

  if (!project) {
    res
      .status(403)
      .send({
        success: false,
        reason: 'project not provided'
      });
    return;
  }

  const [user] = await db.query(`SELECT * FROM user WHERE github_id=${auth.i}`);

  if (!user) {
    res
      .status(403)
      .send({
        success: false,
        reason: 'user not found'
      });
    return;
  }

  const newRepo = `${project.replace('bbDev', 'dev')}-${user.username}`;
  bbDev
    .repos
    .createForAuthenticatedUser({
      name: newRepo,
      description: `clone of ${project} for ${user.username}`,
      private: true,
    })
    .then(_ => bbDev.migrations.startImport({
      owner: process.env.GIT_USER,
      repo: newRepo,
      vcs_url: `https://github.com/blablaDev-hub/${project}`,
      vcs: 'git'
    }))
    .then(_ => bbDev.repos.addCollaborator({
      owner: process.env.GIT_USER,
      repo: newRepo,
      username: user.username,
      permission: 'pull'
    }))
    .then(invite => {
      console.log(invite);

      const project = {
        user_id: user.github_id,
        github_id: invite.data.repository.id,
        start: new Date(),
        end: null,
        points: 0,
        review: '',
        name: invite.data.repository.name,
        description: invite.data.repository.description,
        html_url: invite.data.repository.html_url,
        review_count: 0
      };

      db.query(`INSERT INTO project SET ?`, project);
      res.send({
        success: true,
        data: {
          invite_id: invite.data.id,
          repository: project
        }
      });
      addBranchProtection(bbDev, newRepo);
    })
    .catch(next);
});

/**
 * @desc accept repo invitation
 * @param {Number} invitation_id
 */
router.get('/accept_invite/:invitation_id', (req, res, next) => {
  const {
    bbDev
  } = res.locals;
  const {
    invitation_id
  } = req.params;
  if (!invitation_id) {
    res.send({
      success: false,
      reason: 'invitation_id not provided'
    });
    return;
  }

  bbDev
    .repos
    .acceptInvitation({
      invitation_id
    })
    .then(_ => res.send({
      success: true
    }))
    .catch(next);
});

export default router;
