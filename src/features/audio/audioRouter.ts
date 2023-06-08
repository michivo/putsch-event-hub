import express from 'express';
import { decorateRouter } from '@awaitjs/express';
import { validationResult } from 'express-validator';
import { BadRequestError } from '../../infrastructure/errors';
import AudioService from './audioService';
import { database } from '../../infrastructure/data/dataContext';

const router = decorateRouter(express.Router());
const audio = new AudioService(database);

/**
 * @openapi
 * definitions:
 *   VolumeSettings:
 *     properties:
 *       volume:
 *         type: number
 *       playerId:
 *         type: string
 */

/**
 * @openapi
 * tags:
 *   name: Audio
 *   description: For getting / posting audio settings
 */

/**
 * @openapi
 * /api/v1/audio:
 *   post:
 *     tags:
 *       - Audio
 *     produces:
 *       - application/json
 *     requestBody:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/VolumeSettings'
 *         required: true
 *         description: Volume settings for a player
 *     description: Sets current volume for player
 *     summary: Sets the current volume for a given player
 *     responses:
 *       200:
 *         description: The settings that were updated/inserted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/VolumeSettings'
 */
router.postAsync('/', async (req: express.Request, res: express.Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError(JSON.stringify(errors));
    }

    res.send(await audio.setVolume(req.body));
});

/**
 * @openapi
 * /api/v1/audio:
 *   get:
 *     tags:
 *       - Audio
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: query
 *         name: playerId
 *         type: string
 *     description: Returns player's current stage
 *     summary: Gets current stage for player
 *     responses:
 *       200:
 *         description: The player's current stage
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/VolumeSettings'
 */
router.getAsync('/', async (req: express.Request, res: express.Response) => {
    const { playerId } = req.query;
    console.log(`Getting volume for ${playerId}`);
    if (playerId) {
        const volumeSettings = await audio.getVolume(playerId as string);
        res.send(volumeSettings);
    }
    else {
        res.status(400);
        res.send('PlayerId missing.');
    }
});

export default router;
