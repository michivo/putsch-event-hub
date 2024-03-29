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
 *   FeedbackFriendEvent:
 *     required:
 *       - playerId
 *     properties:
 *       playerId:
 *         type: string
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
 *
 *   ResetPlayersRequest:
 *     properties:
 *       playerId:
 *         type: string
 */

/**
 * @openapi
 * definitions:
 *   PlayerQuestStage:
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
 *       stageIndex:
 *         type: number
 *       name:
 *         type: string
 */

/**
 * @openapi
 * definitions:
 *   PlayableQuest:
 *     properties:
 *       id:
 *         type: number
 *       subNumber:
 *         type: number
 *       state:
 *         type: string
 *       name:
 *         type: string
 *       description:
 *         type: string
 *       phase:
 *         items:
 *           type: number
 *         type: array
 *       repeatable:
 *         type: boolean
 *       parallel:
 *         type: boolean
 *       cooldownTimeMinutes:
 *         type: number
 *       stages:
 *         items:
 *           $ref: '#/definitions/PlayableQuestStage'
 *         type: array
 *     required:
 *       - id
 *       - subNumber
 *       - state
 *       - name
 *       - description
 *       - phase
 *       - repeatable
 *       - parallel
 *       - cooldownTimeMinutes
 *       - stages
 */

/**
 * @openapi
 * definitions:
 *   PlayableQuestStage:
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
 * /api/v1/events/feedback-friend:
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
 *         description: The player ID visiting feedback friend
 *     description: Returns inserted event
 *     summary: Processes a sensor event at feedback friend.
 *     responses:
 *       200:
 *         description: The event that was inserted/updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/Event'
 */
router.postAsync('/feedback-friend', async (req: express.Request, res: express.Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError(JSON.stringify(errors));
    }

    res.send(await eventService.feedbackFriend({
        playerId: req.body.playerId,
        sensorId: 'Feedbackfreund',
        value: '',
        eventDateUtc: '',
    }));
});

/**
 * @openapi
 * /api/v1/events/batch:
 *   post:
 *     tags:
 *       - Events
 *     produces:
 *       - application/json
 *     requestBody:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/definitions/Event'
 *         required: true
 *         description: A list of sensor events
 *     description: Returns inserted event
 *     summary: Processes a list of sensor events.
 *     responses:
 *       200:
 *         description: The events that were inserted/updated
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/definitions/Event'
 */
router.postAsync('/batch', async (req: express.Request, res: express.Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError(JSON.stringify(errors));
    }

    res.send(await eventService.upsertEventsBulk(req.body));
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
 * /api/v1/events/players/resetRequests:
 *   post:
 *     tags:
 *       - Events
 *     produces:
 *       - application/json
 *     requestBody:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/ResetPlayersRequest'
 *         required: true
 *         description: Start Quest Request
 *     description: Resets a player's request
 *     summary: If a player id is passed, only this player will be reset - else, all will be reset.
 *     responses:
 *       200:
 *         description: OK
 */
router.postAsync('/players/resetRequests', async (req: express.Request, res: express.Response) => {
    await eventService.resetPlayers(req.body.playerId);
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
 *               $ref: '#/definitions/PlayerQuestStage'
 */
router.getAsync('/stage', async (req: express.Request, res: express.Response) => {
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
        res.send('PlayerId missing.');
    }
});

/**
 * @openapi
 * /api/v1/events/bauxi:
 *   get:
 *     tags:
 *       - Events
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: query
 *         name: playerId
 *         type: string
 *       - in: query
 *         name: playlistName
 *         type: string
 *     description: Creates a dummy event for bauxi
 *     summary: Creates a dummy event for bauxi
 *     responses:
 *       200:
 *         description: Should be 'OK' or so
 */
router.getAsync('/bauxi', async (req: express.Request, res: express.Response) => {
    const { playerId, playlistName } = req.query;
    console.log(`Getting dummy event for ${playerId} / ${playlistName}`);
    if (playerId && playlistName) {
        await eventService.dummyUpdateData(playerId?.toString(), playlistName?.toString());
        res.send('OK');
    }
    else {
        res.status(400).send('playerId and/or playlistName missing.');
    }
});

/**
 * @openapi
 * /api/v1/events/playableQuests:
 *   get:
 *     tags:
 *       - Events
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: query
 *         name: playerId
 *         type: string
 *       - in: query
 *         name: phaseId
 *         type: string
 *     description: Returns all quests playable by the player with the given id
 *     summary: Gets all quests playable by player with given id
 *     responses:
 *       200:
 *         description: 'OK'
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/definitions/Quest'
 */
router.getAsync('/playableQuests', async (req: express.Request, res: express.Response) => {
    const { playerId, phaseId } = req.query;
    res.send(await eventService.getPlayableQuests(playerId as string, phaseId as string));
});

export default router;
