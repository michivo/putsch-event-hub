import express from 'express';
import { decorateRouter } from '@awaitjs/express';
import GameDataService from './gameDataService';

const router = decorateRouter(express.Router());
const eventService = new GameDataService();

/**
 * @openapi
 * definitions:
 *   Player:
 *     properties:
 *       id:
 *         type: string
 *       homeOffice:
 *         type: string
 *       aisle:
 *         type: string
 *       questsComplete:
 *         type: array
 *         items:
 *           type: string
 *       questsActive:
 *         type: array
 *         items:
 *           type: string
 *
 *   Quest:
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
 *           $ref: '#/definitions/QuestStage'
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
 *
 *   QuestStage:
 *     properties:
 *       triggerType:
 *         type: string
 *       triggerIds:
 *         items:
 *           type: string
 *         type: array
 *       nonTriggerIds:
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

/*
 * @openapi
 * tags:
 *   name: GameData
 *   description: For getting/manipulating game data
 */
/*
 * @openapi
 * /api/v1/game-data/players:
 *   get:
 *     tags:
 *       - GameData
 *     produces:
 *       - application/json
 *     description: Returns all players
 *     summary: Gets all players with id, current quest(s), ...
 *     responses:
 *       200:
 *         description: 'OK'
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/definitions/Player'
 */
router.getAsync('/players',
    async (_: express.Request, res: express.Response) => {
    res.send(await eventService.getPlayers());
});

/**
 * @openapi
 * /api/v1/game-data/quests:
 *   get:
 *     tags:
 *       - GameData
 *     produces:
 *       - application/json
 *     description: Returns all players
 *     summary: Gets all players with id, current quest(s), ...
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
router.getAsync('/quests',
    async (_: express.Request, res: express.Response) => {
    res.send(await eventService.getQuests());
});


export default router;
