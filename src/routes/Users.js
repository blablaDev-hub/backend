import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import DB from './../db';
import {
  gitHubUserOAuth,
  checkAuth,
} from './../middlewares';
import {
  encrypt
} from './../helpers';

const db = new DB();
const router = express.Router();
const upload = multer({
  dest: 'cv/',
  fileFilter: (req, file, cb) => {
    const ext = file
      .originalname
      .split('.')
      .pop();

    if (ext == 'pdf' || ext == 'doc' || ext == 'docx') {
      cb(null, true);
    }
    return cb(null, false);
  }
});
dotenv.config();

/**
 * @desc authenticate user with code from github
 * if user is comming first time, store it in DB
 */
router.post('/auth', upload.none(), gitHubUserOAuth, (req, res, next) => {
  let didInsert = false;
  const {
    token,
    userGitHub,
  } = res.locals.auth;

  userGitHub
    .users
    .getAuthenticated()
    .then(response => {
      const user = {
        github_id: response.data.id,
        username: response.data.login,
        full_name: response.data.name,
        github_url: response.data.html_url,
        avatar: response.data.avatar_url,
        location: response.data.location,
        company: response.data.company,
        blog: response.data.blog,
        email: response.data.email,
        hireable: response.data.hireable,
        bio: response.data.bio,
        registered: new Date()
      };

      db
        .query(`SELECT * FROM user WHERE github_id=${user.github_id}`)
        .then(rows => {
          if (rows[0])
            return rows[0];

          didInsert = true;
          return db.query(`INSERT INTO user SET ?`, user);
        })
        .then(dbRes => {
          const bbDev = encrypt(JSON.stringify({
            g: token,
            i: user.github_id,
            t: 'dev'
          }));
          res.cookie('bbDev', bbDev, {
            maxAge: 15 * 24 * 60 * 60 * 1000
          });
          res.send({
            success: true,
            data: didInsert ?
              user :
              dbRes
          });
        })
        .catch(next);
    })
    .catch(next);
});

/**
 * @desc check user session
 * if valid return user
 */
router.get('/check_session', checkAuth, (req, res, next) => {
  const { i: id } = res.locals.auth;
  console.log(id);

  db
  .query(`SELECT * FROM user WHERE github_id=${id}`)
  .then(dbRes => {
    const [user] = dbRes;
    res.send({
      success: true,
      data: user
    })
  })
  .catch(next)
})

/**
 * @desc upload CV
 */
router.patch('/upload_cv', checkAuth, upload.single('cv'), (req, res, next) => {
  const {
    file
  } = req;
  const {
    i: id
  } = res.locals.auth;

  if (file) {
    const cv = {
      cv_url: file.path,
      cv_title: file.originalname
    };

    db.query(`UPDATE user SET ? WHERE github_id=${id}`, cv);
    res.send({
      success: true,
      data: cv
    });
  } else {
    res
      .status(415)
      .send({
        success: false,
        reason: 'bad format'
      });
  }
});

/**
 * @desc check user invites
 */
router.get('/check_invites', checkAuth, (req, res, next) => {
  const {
    userGitHub
  } = res.locals.auth;

  userGitHub
    .repos
    .listInvitationsForAuthenticatedUser()
    .then(invites => {
      const bbDevInvites = invites
        .data
        .filter(i => i.repository.full_name.startsWith(process.env.GIT_USER))
        .map(i => ({
          id: i.id,
          repository: {
            id: i.repository.id,
            name: i.repository.name,
            html_url: i.repository.html_url,
            description: i.repository.description
          }
        }));
      res.send({
        success: true,
        data: bbDevInvites
      });
    })
    .catch(next);
});

/**
 * @desc get user projects
 */
router.get('/get_projects', checkAuth, (req, res, next) => {
  const {
    auth
  } = res.locals;

  db
    .query(`SELECT * FROM project where user_id=${auth.i}`)
    .then(rows => {
      res.send({
        success: true,
        data: rows
      });
    })
    .catch(next);
});

/**
 * @desc log out user, expire cookie
 */
router.delete('/logout', checkAuth, (req, res, next) => {
  res.cookie('bbDev', {
    expires: Date.now(0)
  });
  res.send({
    success: true
  });
});

export default router;
