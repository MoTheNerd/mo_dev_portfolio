require('dotenv').config();
import express from 'express'
import moment from 'moment'
import bodyParser from 'body-parser'
import crypto from 'crypto'
import aws from 'aws-sdk'
import { PutObjectRequest } from "aws-sdk/clients/s3";
import { Buffer } from "buffer";
import { exit } from 'process';
import axios from 'axios'
import {Connection, createConnection} from 'mysql2';

const s3 = new aws.S3({
    endpoint: 'sfo2.digitaloceanspaces.com',
    accessKeyId: process.env.MO_DEV_SPACE_KEY,
    secretAccessKey: process.env.MO_DEV_SPACE_SECRET,
});


const mysqlcs = process.env.MYSQL_CONNECTION_STRING;
const schema: "prod" | "dev" = process.env.MYSQL_SCHEMA === "prod" ? "prod" : "dev";
const port = process.env.PORT ? process.env.PORT : 6002;
const app = express();
let dbConn: Connection;

try {
    dbConn = createConnection(mysqlcs!);
} catch (error) {
    console.error("There was no connection string specified for the sql server");
    exit(-1);
}

app.use(bodyParser.json());
app.use((req, res, next)=>{
    res.setHeader('Access-Control-Allow-Origin', '*');

    next();
})

app.get("/", (req: express.Request, res: express.Response) => {
    res.send("Portfolio MicroService API is running")
})

// get all posts
app.get("/posts", async (req: express.Request, res: express.Response) => {
    dbConn.query(`SELECT * FROM ${schema}.portfolio`, (a, b) => {
        res.send(b);
    })
});

const checkTokenAuthenticatedWithAuthServer = async (token: String) => {
    let status = (await axios.post(`/auth/authenticateUsingToken`, { token })).data.code
    return status === 200 ? true : false
}

app.listen(port, () => console.log(`Portfolio microservice listening on port: ${port}!`))