///<reference types="jest"/>
import * as mockfs from 'mock-fs'
// import * as fs from 'fs'
// import * as path from 'path'
import _ from 'lodash';
import { AbsPath, MockFSHelper } from "../index"
import { GitLogic } from '../git_logic';
import * as tmp from 'tmp';

tmp.setGracefulCleanup()

let tmpdir_obj: tmp.SynchrounousResult
let tmpdir: AbsPath


beforeEach(async () => {
    tmpdir_obj = tmp.dirSync({ unsafeCleanup: true })
    tmpdir = new AbsPath(tmpdir_obj.name)
    console.log("*** Creating temp dir:", tmpdir.realpath)
    init_simple_repo()
})

afterEach(async () => {
    tmpdir_obj.removeCallback()
})


function init_simple_repo() {
    const gitbase = tmpdir.add('proj').add('.git')
    gitbase.add('objects').add('info').mkdirs()
    gitbase.add('objects').add('pack').mkdirs()
    gitbase.add('refs').add('heads').mkdirs()
    gitbase.add('refs').add('tags').mkdirs()
    gitbase.add('HEAD').saveStrSync('ref: refs/heads/master')

    tmpdir.add('non_proj').mkdirs()
}


describe('git logic', () => {
    test('repo detection', () => {
        init_simple_repo()
        let gl = new GitLogic(tmpdir.add('proj'));
        expect(gl.is_repo).toBeTruthy()

        let gl2 = new GitLogic(new AbsPath('/non_proj'));
        expect(gl2.is_repo).toBeFalsy()
    })

    test('check ignore', () => {
        let gl = new GitLogic(tmpdir.add('proj'));
        expect(gl.is_repo).toBeTruthy()

        
    })
})