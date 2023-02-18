import express from 'express';
import { decorateRouter } from '@awaitjs/express';
import { validationResult } from 'express-validator';
import { BadRequestError } from '../../infrastructure/errors';
import EventService from './eventService';
import { database } from '../../infrastructure/data/dataContext';
import GameDataService from '../gameData/gameDataService';

const router = decorateRouter(express.Router());
const gameDataService = new GameDataService();
const eventService = new EventService(database, gameDataService);

/**
 * @openapi
 * definitions:
 *   Event:
 *     required:
 *       - sensorId
 *       - value
 *     properties:
 *       sensorId:
 *         type: string
 *       playerId:
 *         type: string
 *       eventDateUtc:
 *         type: string
 *       value:
 *         - type: string
 *         - type: integer
 *         - type: number
 *         - type: boolean
 *
 *   StartQuestRequest:
 *     required:
 *       - playerId
 *       - questId
 *     properties:
 *       playerId:
 *         type: string
 *       questId:
 *         type: string
 */

/**
 * @openapi
 * definitions:
 *   QuestStage:
 *     properties:
 *       triggerType:
 *         type: string
 *       triggerIds:
 *         items:
 *           type: string
 *         type: array
 *       text:
 *         type: string
 *       backupTimeSeconds:
 *         type: number
 *       backupTextId:
 *         type: string
 */

/**
 * @openapi
 * tags:
 *   name: Events
 *   description: For posting events
 */

/**
 * @openapi
 * /api/v1/events:
 *   post:
 *     tags:
 *       - Events
 *     produces:
 *       - application/json
 *     requestBody:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/Event'
 *         required: true
 *         description: A sensor event
 *     description: Returns inserted event
 *     summary: Processes a sensor event.
 *     responses:
 *       200:
 *         description: The event that was inserted/updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/Event'
 */
router.postAsync('/', async (req: express.Request, res: express.Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError(JSON.stringify(errors));
    }

    res.send(await eventService.upsertEvent(req.body));
});

/**
 * @openapi
 * /api/v1/events:
 *   get:
 *     tags:
 *       - Events
 *     produces:
 *       - application/json
 *     description: Returns all sensor values
 *     summary: Gets all sensor values
 *     responses:
 *       200:
 *         description: 'OK'
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/definitions/Event'
 */
router.getAsync('/', async (_: express.Request, res: express.Response) => {
    res.send(await eventService.get());
});

/**
 * @openapi
 * /api/v1/events/quests/startRequests:
 *   post:
 *     tags:
 *       - Events
 *     produces:
 *       - application/json
 *     requestBody:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/StartQuestRequest'
 *         required: true
 *         description: Start Quest Request
 *     description: Starts a quest for a player
 *     summary: Starts a new quest for a player.
 *     responses:
 *       200:
 *         description: OK
 */
router.postAsync('/quests/startRequests', async (req: express.Request, res: express.Response) => {
    await eventService.startQuest(req.body.playerId, req.body.questId);
    res.send('OK');
});

/**
 * @openapi
 * /api/v1/events/stage:
 *   get:
 *     tags:
 *       - Events
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
 *               $ref: '#/definitions/QuestStage'
 */
router.getAsync('/events/stage', async (req: express.Request, res: express.Response) => {
    const { playerId } = req.query;
    console.log(`Getting stage info for ${playerId}`);
    if (playerId) {
        const stage = await eventService.getCurrentStage(playerId?.toString());
        if (stage) {
            res.send(stage);
        } else {
            res.status(404);
            res.send(`No stage for Player with id ${playerId} was found.`)
        }
    }
    else {
        res.status(400);
        res.render('error', { error: 'PlayerId missing.' });
    }
});

export default router;
