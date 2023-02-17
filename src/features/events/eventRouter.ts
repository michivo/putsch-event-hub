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
router.postAsync('/',
    async (req: express.Request, res: express.Response) => {
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
router.getAsync('/',
    async (_: express.Request, res: express.Response) => {
    res.send(await eventService.get());
});


export default router;
