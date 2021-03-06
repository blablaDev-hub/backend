import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
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
const upload = multer();
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
      res.send({
        success: true,
        data: values
      });
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
      success: true,
      data: {
        name: readme.data.name,
        download_url: readme.data.download_url,
        content: readme.data.content,
        encoding: readme.data.encoding
      }
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
router.post('/start', upload.none(), async (req, res, next) => {
  const {
    bbDev,
    auth,
  } = res.locals;
  const {
    project
  } = req.body;

  if (!project) {
    res
      .status(400)
      .send({
        success: false,
        reason: 'project not provided'
      });
    return;
  }

  const [user] = await db.query(`SELECT * FROM user WHERE github_id=${auth.i}`);

  if (!user) {
    res
      .status(400)
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
      private: true
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
      const project = {
        description: invite.data.repository.description,
        end: null,
        github_id: invite.data.repository.id,
        html_url: invite.data.repository.html_url,
        name: invite.data.repository.name,
        points: 0,
        review: '',
        review_count: 0,
        start: new Date(),
        user_id: user.github_id,
      };

      db
        .query(`INSERT INTO project SET ?`, project)
        .then(dbRes => {
          project.id = dbRes.insertId;

          res.send({
            success: true,
            data: {
              project,
              invite: {
                id: invite.data.id,
                repository: {
                  description: project.description,
                  html_url: project.html_url,
                  id: project.github_id,
                  name: project.name,
                }
              }
            }
          });
        })

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
    userGitHub
  } = res.locals.auth;
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

  userGitHub
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
