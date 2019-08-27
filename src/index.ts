require('dotenv').config();
import { Db, MongoError, MongoClient } from "mongodb";
import express from 'express'
import moment from 'moment'
import bodyParser from 'body-parser'
import crypto from 'crypto'
import aws from 'aws-sdk'
import { PutObjectRequest } from "aws-sdk/clients/s3";
import { Buffer } from "buffer";
import axios from 'axios'

const s3 = new aws.S3({
    endpoint: 'sfo2.digitaloceanspaces.com',
    accessKeyId: process.env.MO_DEV_SPACE_KEY,
    secretAccessKey: process.env.MO_DEV_SPACE_SECRET,
});

const mongocs = process.env.MONGO_CONNECTION_STRING;
let db: Db;
const port = process.env.PORT ? process.env.PORT : 6002;
const app = express();

app.use(bodyParser.json());

require('mongodb').connect(mongocs, { useNewUrlParser: true, useUnifiedTopology: true }, (err: MongoError, result: MongoClient) => {
    if (err) {
        console.log(err)
        process.exit(1);
    } else {
        db = result.db('default')
    }
})

app.get("/", (req: express.Request, res: express.Response) => {
    res.send("Portfolio MicroService API is running")
})

// get all posts
app.get("/posts", async (req: express.Request, res: express.Response) => {
    let posts = await db.collection('portfolio_posts').find({}).toArray()
    res.send(posts.map((post) => {
        return {
            ...post,
            postId: post._id,
            _id: undefined
        }
    }));
});

// get post in detail by ID
app.get("/post/:postId", async (req: express.Request, res: express.Response) => {
    let result = await db.collection('portfolio_posts').find({ _id: req.params.postId }).toArray()
    res.send(result[0])
});

const checkTokenAuthenticatedWithAuthServer = async (token: String) => {
    let status = (await axios.post(`/api/auth/authenticateUsingToken`, { token })).data.code
    return status === 200 ? true : false
}

// create a post
app.post("/post", async (req: express.Request, res: express.Response) => {
    /**
     * Posts have the following:
     * Title
     * short description
     * long description
     * link
     * link text
     * picture uri
     * date created
     * date modified -> initially undefined
     */
    if (req.body.token) {
        if (await checkTokenAuthenticatedWithAuthServer(req.body.token)) {
            let putObjReq: PutObjectRequest
            var base64Data = req.body.data.replace(/^data:image\/png;base64,/, "").replace(/^data:image\/jpeg;base64,/, "");
            let filename = `portfolio_thumbnails/${crypto.randomBytes(2).toString('hex')}_${moment.utc().toISOString()}_${req.body.filename}`
            putObjReq = {
                Bucket: 'modev',
                Key: `${filename}`,
                Body: Buffer.from(base64Data, "base64"),
                ACL: 'public-read',
                ContentType: `image/${req.body.filename.split('.')[req.body.filename.split('.').length - 1].toLowerCase() === 'png' ? 'png' : 'jpeg'}`
            }
            await s3.upload(putObjReq, async (err, file) => {
                if (err) {
                    res.send({
                        code: 500,
                        message: "An internal server error occurred"
                    })
                } else {
                    await db.collection('portfolio_posts').insertOne({
                        title: req.body.post.title,
                        short_description: req.body.post.short_description,
                        long_description: req.body.post.long_description,
                        link: req.body.post.link,
                        link_text: req.body.post.link_text,
                        picture_uri: `https://modev.sfo2.digitaloceanspaces.com/${filename}`,
                        date_created: moment.utc().toDate()
                    })
                    res.send({
                        code: 200,
                        message: "success"
                    })
                }
            })
        } else {
            res.send({
                code: 301,
                message: "you are not authenticated"
            })
        }
    } else {
        res.send({
            code: 301,
            message: "you are not authenticated"
        })
    }
});

// edit a post
app.put("/post/:postId", async (req: express.Request, res: express.Response) => {
    if (req.body.token) {
        if (await checkTokenAuthenticatedWithAuthServer(req.body.token)) {
            let initialPost = (await db.collection('portfolio_posts').find({ _id: req.params.postId }).toArray())[0]
            if (initialPost) {
                await db.collection('portfolio_posts').updateOne({ _id: initialPost.postId }, { ...req.body.post, date_modified: moment.utc().toDate() })
                res.send({
                    code: 200,
                    message: "success"
                })
            } else {
                res.send({
                    code: 301,
                    message: "you are not authenticated"
                })
            }
        } else {
            res.send({
                code: 301,
                message: "you are not authenticated"
            })
        }
    } else {
        res.send({
            code: 301,
            message: "you are not authenticated"
        })
    }
})

app.listen(port, () => console.log(`Portfolio microservice listening on port: ${port}!`))