import express from 'express';
import Users from './Users';
import Projects from './Projects';

const router = express.Router();

router.use('/users', Users);
router.use('/projects', Projects);

router.get('/', (req, res) => res.send('#bbDev'));

export default router;
