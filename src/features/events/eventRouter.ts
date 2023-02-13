import express from 'express';
import { decorateRouter } from '@awaitjs/express';
import { validationResult } from 'express-validator';
import { BadRequestError } from '../../infrastructure/errors';
import EventService from './eventService';

const router = decorateRouter(express.Router());
const eventService = new EventService();

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
 *     parameters:
 *       - in: body
 *         name: event
 *         schema:
 *           $ref: '#/definitions/Event'
 *         required: true
 *         description: A sensor event
 *     description: Returns 'OK'
 *     summary: Processes a sensor event.
 *     responses:
 *       200:
 *         description: 'OK'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/Greeting'
 */
router.postAsync('/',
    async (req: express.Request, res: express.Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new BadRequestError(JSON.stringify(errors));
        }
        console.log(req);

        res.send(eventService.handleEvent(req.body));
});


export default router;
