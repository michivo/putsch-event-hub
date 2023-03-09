import express from 'express';
import { decorateRouter } from '@awaitjs/express';
import { param, validationResult } from 'express-validator';
import { BadRequestError } from '../../infrastructure/errors';
import HealthService from './healthService';

const router = decorateRouter(express.Router());
const healthService = new HealthService();

/**
 * @openapi
 * definitions:
 *   Greeting:
 *     required:
 *       - message
 *     properties:
 *       message:
 *         type: string
 */

/**
 * @openapi
 * tags:
 *   name: Health
 *   description: For checking if the system is up and running...
 */

/**
 * @openapi
 * /api/v1/health/hello/{name}:
 *   get:
 *     tags:
 *       - Health
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: name
 *         schema:
 *           type: string
 *         required: true
 *         description: Your name
 *     description: Returns a nice greeting.
 *     summary: Greets you.
 *     responses:
 *       200:
 *         description: A nice greeting.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/Greeting'
 */
router.getAsync('/hello/:name', param('name').isString().notEmpty(),
    async (req: express.Request, res: express.Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new BadRequestError(JSON.stringify(errors));
        }

        res.send(healthService.sayHello(req.params.name));
});


export default router;
