import { google } from 'googleapis';
import { Player } from '../../typings/player';
import credentials from '../../keys/sheets-service-account.json';
import config from 'config';
import { Quest, QuestStage } from '../../typings/quest';

const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

function split(s: string): string[] {
    if(!s) {
        return [];
    }

    return s.split(',').filter(s => !!s).map(s.trim);
}

async function loadData(range: string) : Promise<any[][] | null | undefined> {
    const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: scopes,
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.get('spreadsheetId'),
        range: range,
    });
    if(!res || !res.data) {
        return null;
    }
    return res.data.values;
}

async function getPlayers(): Promise<Player[]> {
    let rows = await loadData('Player!A:H');

    if (!rows || rows.length < 2) {
        console.log('No data found.');
        return [];
    }
    rows = rows.slice(1);
    console.log(`Loading ${rows.length} rows.`);

    const result: Player[] = [];
    for (const row of rows) {
        const player: Player = {
            id: row[0],
            homeOffice: row[1],
            aisle: row[2],
            phase: row[3],
            questsComplete: split(row[4]),
            questsActive: split(row[5]),
            homeRadio: row[7],
        };
        result.push(player);
    }

    return result;
}

async function getQuests(): Promise<Quest[]> {
    console.log('Getting quests...');
    let rows = await loadData('Quests');
    if (!rows || rows.length < 2) {
        console.log('No data found.');
        return [];
    }
    const result: Quest[] = [];
    rows = rows.slice(1);
    for (const row of rows) {
        if(!row[0] || row[0].toString().trim() === '' || (row[1] && row[1].toString().trim !== '')) {
            continue;
        }
        const quest: Quest = {
            id: row[0].toString(),
            subNumber: readSubNumber(row[1]),
            cooldownTimeMinutes: parseInt(row[15]),
            description: row[6],
            name: row[4],
            parallel: row[14] && row[14].toLowerCase().includes('y'),
            phases: readIntArray(row[9]),
            repeatable: row[13] && row[13].toLowerCase().includes('y'),
            stages: [],
            state: row[5],
            preconditionsPlayer: row[7],
            preconditionsQuest: row[8],
            npcs: row[10],
        };
        for(let colIdx = 16; colIdx <= row.length - 6; colIdx += 13) {
            const stageFields = row.slice(colIdx, colIdx + 13);
            if(stageFields.length < 6) {
                break;
            }
            const stage: QuestStage = {
                triggerType: stageFields[0],
                triggerIds: readStringArray(stageFields[1]),
                name: stageFields.length > 6 ? stageFields[6] : 'No Name',
                text: stageFields.length > 8 ? stageFields[8] : '',
                backupTimeSeconds: stageFields.length > 10 ?  parseInt(stageFields[10]) : 0,
                backupTextId: stageFields.length > 11 ?  stageFields[11] : 11,
                playlistName: stageFields[5],
                radioId: stageFields[2],
                radioPlaylistName: stageFields[3],
                preconditions: stageFields[4],
                sleepTime: stageFields.length > 12 ?  parseInt(stageFields[12]) : 12,
                npcName: stageFields.length > 9 ? stageFields[9] : 9,
            };
            if(stage.triggerIds && stage.triggerIds.length > 0) {
                quest.stages.push(stage);
            }
        }
        result.push(quest);
    }
    return result;
}

function readStringArray(val: string | undefined | null) {
    if(!val) {
        return [];
    }

    return val.split(',').map((s: string) => s.trim());
}

function readIntArray(val: number | string | null | undefined) {
    if(!val) {
        return [];
    }

    if(typeof val === 'number') {
        return [val];
    }

    return val.split(',').filter((v: string) => !!v).map((x: string) => parseInt(x, 10)).filter((n: number) => !isNaN(n));
}

function readSubNumber(val: string) {
    if(!val) {
        return 0;
    }
    const parts = val.split('.');
    if(parts.length > 1) {
        const intValue = parseInt(parts[1]);
        if(isNaN(intValue)) {
            return 0;
        }
        return intValue;
    }

    return 0;
}

export { getPlayers, getQuests };
