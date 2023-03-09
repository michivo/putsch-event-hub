import express from 'express';
import { decorateRouter } from '@awaitjs/express';
import PlaylistService from './playlistService';
import { param, validationResult } from 'express-validator';
import { BadRequestError } from '../../infrastructure/errors';

const router = decorateRouter(express.Router());
const playlistService = new PlaylistService();

/**
 * @openapi
 * definitions:
 *   Playlist:
 *     properties:
 *       name:
 *         type: string
 *       audioFiles:
 *         type: array
 *         items:
 *           type: string
 */

/**
 * @openapi
 * definitions:
 *   Playlists:
 *     properties:
 *       listNames:
 *         items:
 *           type: string
 *         type: array
 */

/**
 * @openapi
 * tags:
 *   name: Playlists
 *   description: For getting playlists
 */

/**
 * @openapi
 * /api/v1/playlists/{name}:
 *   get:
 *     tags:
 *       - Playlists
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: name
 *         type: string
 *     description: Returns the playlist with the given name in the given stage
 *     summary: Gets audio playlist
 *     responses:
 *       200:
 *         description: The player's current stage
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/definitions/Playlist'
 */
router.getAsync('/:name',
param('name').isString().notEmpty(),
async (req: express.Request, res: express.Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new BadRequestError(JSON.stringify(errors));
    }

    res.send(await playlistService.getPlaylist(req.params.name));
});


export default router;
