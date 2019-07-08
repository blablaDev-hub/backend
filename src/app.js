import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import routes from './routes';

// init .env
dotenv.config();

const app = express();
app.use(cookieParser());
app.use(routes);

app.listen(process.env.PORT, () => console.log(`bbDev listening on port ${process.env.PORT}`));
