import overwatch from '../src/overwatch';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { UpdateEvent } from '../src/docs/docs';
import utils from '../src/utils/utils';
import eventsManager from '../src/events/manager';

describe('Overwatch', () => {
    const testDir = path.join(tmpdir(), 'overwatch-test');
    const testFile = path.join(testDir, 'file.txt');

    beforeAll(async () => {
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(testFile, 'initial');
    });

    afterAll(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
        eventsManager.emit.shutdown();
    });

    it('detects file updates', async () => {
        const watcher = await overwatch.watchFile(testFile);

        const event = await new Promise<UpdateEvent>((resolve) => {
            watcher.onUpdate((e) => resolve(e));
            fs.writeFile(testFile, 'updated');
        });

        expect(event.path).toBe(atomix.path.normalizePath(testFile));
        expect(event.type).toBe('File');
    });

    it('ignores excluded files', async () => {
        let triggered = false;
        const watcher = await overwatch.watch(testDir, {
            exclude: [testFile],
        });

        watcher.onChange((change) => {
            triggered = true;
        });

        await fs.writeFile(testFile, 'excluded');

        // Wait some time to confirm no event triggers
        await new Promise((res) => setTimeout(res, 2000));

        expect(triggered).toBe(false);
    });

    it('can define handlers upon creating the watcher', async () => {
        await overwatch.watch(testDir, {
            onUpdate: (event) => {
                expect(event.path).toBe(atomix.path.normalizePath(testFile));
                expect(event.type).toBe('File');
            }
        })

        await fs.writeFile(testFile, 'updated');
    })
});