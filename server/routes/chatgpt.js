import express from 'express'
import {image, prompt, promptStory, translate} from '../services/chatgptService.js'
const router = express.Router()
router.get('/prompt', async (req, res, next) => {
    try {
        res.send(await prompt(req.query.prompt))
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

router.get('/prompt/story', async (req, res, next) => {
    try {
        res.send(await promptStory(req.query.prompt))
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

router.get('/translate', async (req, res, next) => {
    try {
        res.send(await translate(req.query.language, req.query.prompt))
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

router.get('/image/prompt', async (req, res, next) => {
    try {
        res.send(await image(req.query.prompt))
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

export default router
