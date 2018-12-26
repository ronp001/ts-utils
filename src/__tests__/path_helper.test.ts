///<reference types="jest"/>
import * as mockfs from 'mock-fs'
import * as fs from 'fs'
import * as path from 'path'
import _ from 'lodash';
import { AbsPath, MockFSHelper } from "../index"


let simfs = new MockFSHelper({
    '/link1': mockfs.symlink({ path: '/dir1/dir11' }),
    '/link2': mockfs.symlink({ path: '/base/file1' }),
    '/base': {
        'file1': "this is file1",
        'file2': "this is file2",
        'symlink_to_file1': mockfs.symlink({ path: 'file1 ' }),
        'f': "f in /",
        'inner': {
            'file-in-inner': 'this is /base/inner/file-in-inner'
        },
        'inner2': {
            'file-in-inner2': 'this is /base/inner2/file-in-inner2'
        }
    },
    '/dir1': {
        '1file1': "this is 1file1",
        'f': "f in /dir1"
    },
    '/dir1/dir11': {
        '11file1': "this is 11file1",
        '11file2': "this is 11file2",
        'f': "f in /dir1/dir11",
    },
    '/dir1/dir12': {
        '12file1': "this is 12file1",
        '12file2': "this is 12file2",
        'f': "f in /dir1/dir12",
    }
})

// Prepare path_helper.ts for inclusion in the mocked filesystem
// so that exceptions are displayed properly by jest
simfs.addFile(new AbsPath(__dirname).add("../path_helper.ts"))
simfs.addDirContents(new AbsPath(__dirname).add("../../node_modules/callsites"))


beforeEach(async () => {
    mockfs(simfs.fs_structure)
})

afterEach(async () => {
    mockfs.restore()
})

describe("verifying my understanding of node's low level functions", () => {
    test('node.js path functions are working as I think they do', () => {
        expect(path.normalize('/')).toEqual('/')
        expect(path.normalize('/..')).toEqual('/')
        expect(path.normalize('a')).toEqual('a')
        expect(path.normalize('a/b/c/../d')).toEqual('a/b/d')
        expect(path.normalize('a/b/c/../d/')).toEqual('a/b/d/')
    })


})

describe("verifying my understanding of mockfs", () => {
    test('file mocks are working properly', () => {
        let contents = fs.readFileSync('/base/file1')
        expect(contents.toString()).toEqual("this is file1")
        expect(new AbsPath('/base/file1').isFile).toBeTruthy()

        // replace the fs mock
        mockfs({
            '/test2': 'test 2'
        })

        expect(fs.readFileSync('/test2').toString()).toEqual("test 2")
        expect(new AbsPath('/base/file1').isFile).toBeFalsy()
    })

    test('fs mocks', () => {
        expect(fs.lstatSync('/base/file1').isFile()).toBeTruthy()
        expect(fs.lstatSync('/base/file2').isFile()).toBeTruthy()
        expect(fs.lstatSync('/dir1').isDirectory()).toBeTruthy()
        expect(fs.lstatSync('/dir1').isFile()).toBeFalsy()
        expect(fs.lstatSync('/dir1/1file1').isFile()).toBeTruthy()
    })

    test('mockfs({}) adds the current directory', () => {
        mockfs({})
        expect(fs.lstatSync(process.cwd()).isDirectory()).toBeTruthy()
    })
    test('path_helper is in the mocked fs', () => {
        expect(new AbsPath(__dirname + "/../path_helper.ts").isFile).toBeTruthy()
    })

})

describe("AbsPath", () => {
    test('construction', () => {
        let ph = new AbsPath('/');
        expect(ph).toBeInstanceOf(AbsPath)
        expect(new AbsPath('/').abspath).toEqual('/')
    });

    describe("paths", () => {
        test('null path', () => {
            let p = new AbsPath(null)
            expect(p.isSet).toBeFalsy()
            let p2 = new AbsPath('/')
            expect(p2.isSet).toBeTruthy()
        })

        test('creating from relative path', () => {
            process.chdir('/base/inner')
            expect(new AbsPath('..').abspath).toEqual('/base')
            expect(new AbsPath('../inner2').abspath).toEqual('/base/inner2')

            process.chdir('/base')
            expect(new AbsPath('inner2').abspath).toEqual('/base/inner2')
            expect(new AbsPath('./inner2').abspath).toEqual('/base/inner2')
            expect(new AbsPath('.').abspath).toEqual('/base')
            expect(new AbsPath('./').abspath).toEqual('/base/')
            expect(new AbsPath('.//').abspath).toEqual('/base/')
            expect(new AbsPath('/inner2').abspath).toEqual('/inner2')
        })

        test('factory method', () => {
            let p = AbsPath.fromStringAllowingRelative()
            expect(p.isDir).toBeTruthy()
            expect(p.abspath).toEqual(process.cwd())

            p = AbsPath.fromStringAllowingRelative('/')
            expect(p.abspath).toEqual('/')

            p = AbsPath.fromStringAllowingRelative('..')
            expect(p.abspath).toEqual(new AbsPath(process.cwd()).parent.toString())

            p = AbsPath.fromStringAllowingRelative('dir1')
            expect(p.abspath).toEqual(new AbsPath(process.cwd()).add('dir1').toString())
        })


        test('parent', () => {
            let ph = new AbsPath('/dir1/dir11')
            expect(ph.toString()).toEqual("/dir1/dir11")
            expect(ph.parent.toString()).toEqual("/dir1")
            expect(ph.parents(1).toString()).toEqual("/dir1")
            expect(ph.parents(2).toString()).toEqual("/")
            expect(ph.parent.parent.toString()).toEqual("/")
            expect(ph.parent.parent.parent.toString()).toEqual("/")
        })

        test('relativeTo', () => {
            let ph = new AbsPath('/dir1/dir11')
            expect(ph.relativeFrom(new AbsPath('/dir1'))).toEqual("dir11")
            expect(ph.relativeFrom(new AbsPath('/dir1/dir11/dir111'))).toEqual("..")
            expect(ph.relativeFrom(new AbsPath('/dir1'), true)).toEqual("dir11")
            expect(ph.relativeFrom(new AbsPath('/dir2'))).toEqual("../dir1/dir11")
            expect(ph.relativeFrom(new AbsPath('/dir2'), true)).toBeNull()
            expect(ph.relativeFrom(new AbsPath('/dir1/dir11'))).toEqual('.')
        })

        test('basename', () => {
            expect(new AbsPath('/inner2').basename).toEqual('inner2')
            expect(new AbsPath('/inner2/').basename).toEqual('inner2')
        })

        test('add', () => {
            let p = new AbsPath("/dir1")
            expect(p.add('dir2').toString()).toEqual('/dir1/dir2')
            expect(p.add('/dir2').toString()).toEqual('/dir1/dir2')
            expect(p.add('../dir2').toString()).toEqual('/dir2')
        })
    })

    describe("recognition", () => {
        test('is root', () => {
            expect(new AbsPath('/').isRoot).toBeTruthy()
            expect(new AbsPath('/dir1').isRoot).toBeFalsy()
            expect(new AbsPath('/dir1').parent.isRoot).toBeTruthy()
        })
        test('exists', () => {
            expect(new AbsPath('/').exists).toBeTruthy()
            expect(new AbsPath('/dir1').exists).toBeTruthy()
            expect(new AbsPath('/nosuchfile').exists).toBeFalsy()
        })
        test('isFile and isDir', () => {
            expect(new AbsPath('/dir1').isDir).toBeTruthy()
            expect(new AbsPath('/dir1').isFile).toBeFalsy()

            expect(new AbsPath('/dir1/f').isFile).toBeTruthy()
            expect(new AbsPath('/dir1/f').isDir).toBeFalsy()

            expect(new AbsPath('/base/symlink_to_file1').exists).toBeTruthy()
            expect(new AbsPath('/base/symlink_to_file1').isSymLink).toBeTruthy()
            expect(new AbsPath('/base/symlink_to_file1').isDir).toBeFalsy()
            expect(new AbsPath('/base/symlink_to_file1').isFile).toBeFalsy()

            // validations
            const p = new AbsPath('/dir1')
            expect(() => { p.validate('is_dir') }).not.toThrow()
            expect(() => { p.validate('is_file') }).toThrow(/dir1.*not a file/)
            expect(() => { p.validate('is_symlink') }).toThrow(/dir1.*not a symlink/)
            expect(() => { p.validate('is_binary') }).toThrow(/dir1.*not a binary/)
            expect(p.validate("is_dir")).toEqual(p)

            const p2 = new AbsPath('/base/symlink_to_file1')
            expect(() => { p2.validate('is_dir') }).toThrow(/_to_file1.*not a directory/)
            expect(() => { p2.validate('is_file') }).toThrow(/_to_file1.*not a file/)
            expect(() => { p2.validate('is_symlink') }).not.toThrow()
            expect(() => { p2.validate('is_binary') }).toThrow(/_to_file1.*not a binary/)
            expect(p2.validate("is_symlink")).toEqual(p2)
        })
        test('binary file recognition', () => {
            let p1 = new AbsPath("/base/file1")
            let p2 = new AbsPath("/binaryfile")
            console.log("path:", p1.toString())
            expect(p1.isFile).toBeTruthy()
            expect(p1.isBinaryFile).toBeFalsy()

            expect(p2.exists).toBeFalsy()

            fs.writeFileSync(p2.toString(), Buffer.alloc(100))

            expect(p2.isFile).toBeTruthy()
            expect(p2.isBinaryFile).toBeTruthy()
        })
    })

    describe("directory contents", () => {
        test('dir contents', () => {
            mockfs({
                '/dir1': 'f1',
                '/base': 'f2'
            }, { createCwd: false, createTmp: false })

            let p = new AbsPath('/')
            expect(p.dirContents).toEqual([
                new AbsPath('/base'), new AbsPath('/dir1')
            ])
        })
        test('containsFile', () => {
            let ph = new AbsPath('/base');
            expect(ph.containsFile('f')).toBeTruthy()
            expect(ph.containsFile('g')).toBeFalsy()

            ph = new AbsPath('/dir1')
            expect(ph.containsFile('f')).toBeTruthy()

            ph = new AbsPath(null)
            expect(ph.containsFile('f')).toBeFalsy()
        });
        test('containsDir', () => {
            let ph = new AbsPath('/base');
            expect(ph.containsDir('inner')).toBeTruthy()
            expect(ph.containsDir('g')).toBeFalsy()
        });
    })

    describe("exploring the filesystem", () => {
        test('findUpwards', () => {
            let p = new AbsPath('/dir1/dir12')
            expect(p.findUpwards('f').toString()).toEqual('/dir1/dir12/f')
            expect(p.findUpwards('1file1').toString()).toEqual('/dir1/1file1')
            expect(p.findUpwards('g')).toEqual(new AbsPath(null))
            expect(p.findUpwards('g').toString()).toEqual("")
        })
        test('dir hierarchy', () => {
            expect(new AbsPath('/dir1/dir11').dirHierarchy).toEqual([new AbsPath('/dir1/dir11'), new AbsPath('/dir1'), new AbsPath('/')])
            expect(AbsPath.dirHierarchy('/dir1/dir11')).toEqual([new AbsPath('/dir1/dir11'), new AbsPath('/dir1'), new AbsPath('/')])
        })
        test('traversal', () => {
            let p = new AbsPath('/')
            let found_up: { [key: string]: number } = {}
            let found_down: { [key: string]: number } = {}
            let found_file: { [key: string]: number } = {}

            p.foreachEntryInDir((e: AbsPath, direction: "down" | "up" | null) => {
                // for directories, this will be called twice: once on the way down, and once on the way up.
                // for files:  the direction will be null
                if (direction == "down") {
                    found_down[e.abspath] = found_down[e.abspath] ? found_down[e.abspath] + 1 : 1
                } else if (direction == "up") {
                    found_up[e.abspath] = found_up[e.abspath] ? found_up[e.abspath] + 1 : 1
                } else {
                    found_file[e.abspath] = found_file[e.abspath] ? found_file[e.abspath] + 1 : 1
                }
            })

            console.log(found_down)

            expect(found_file['/base/inner/file-in-inner']).toEqual(1)
            expect(found_file['/dir1/dir11/f']).toEqual(1)
            expect(found_down['/base/inner']).toEqual(1)
            expect(found_up['/base/inner']).toEqual(1)

            expect(found_file['/base/inner']).toBeUndefined()
            expect(found_down['/base/inner/file-in-inner']).toBeUndefined()
            expect(found_up['/base/inner/file-in-inner']).toBeUndefined()
        })

        test('print traversal', () => {
            let p = new AbsPath('/')
            p.foreachEntryInDir((e: AbsPath, direction: "down" | "up" | null) => {
                console.log(e.toString(), direction)
            })
        })
    })

    describe('file contents', () => {
        test('contentsBuffer', () => {
            let p = new AbsPath('/base/newfile')
            p.saveStrSync("line1\nline2")
            let contents = p.contentsBuffer
            expect(contents.length).toEqual(11)
            expect(contents[0]).toEqual('l'.charCodeAt(0))
        })

        test('contentsLines', () => {
            let p = new AbsPath('/base/newfile')
            p.saveStrSync("line1\nline2")
            let contents = p.contentsLines
            expect(contents).toHaveLength(2)
            expect(contents[0]).toEqual('line1')
            expect(contents[1]).toEqual('line2')
        })

        test('contentsFromJSON', () => {
            let p = new AbsPath('/base/newfile')
            p.saveStrSync(JSON.stringify({ a: 1, b: 2 }))
            let contents = p.contentsFromJSON
            expect(contents['a']).toEqual(1)
            expect(contents['b']).toEqual(2)
        })
    })

    describe("file versions", () => {
        test('maxver', () => {
            let p = new AbsPath('/base/file1')
            expect(p.existingVersions).toEqual([])
            expect(p.maxVer).toEqual(null)

            new AbsPath('/base/file1.2').saveStrSync('old version')
            expect(p.existingVersions).toEqual([2])
            expect(p.maxVer).toEqual(2)

            new AbsPath('/base/file1.1').saveStrSync('old version')
            expect(p.existingVersions).toEqual([1, 2])
            expect(p.maxVer).toEqual(2)

            new AbsPath('/base/file1.txt').saveStrSync('nothing to do with versions')
            expect(p.maxVer).toEqual(2)

            new AbsPath('/base/file1.txt.1').saveStrSync('old version of other file')
            expect(p.maxVer).toEqual(2)

            new AbsPath('/base/file1.1').rmFile()
            expect(p.maxVer).toEqual(2)
            expect(p.existingVersions).toEqual([2])

            new AbsPath('/base/file1.2').rmFile()
            expect(new AbsPath('/base/file1.2').exists).toBeFalsy()
            expect(p.existingVersions).toEqual([])
            expect(p.maxVer).toEqual(null)
        })

        test('renameToNextVer', () => {
            let p = new AbsPath('/base/file1')
            expect(p.isFile).toBeTruthy()
            expect(new AbsPath('/base/file1.1').isFile).toBeFalsy()

            p.renameToNextVer()
            expect(p.maxVer).toEqual(null)
            expect(p.isFile).toBeFalsy()
            expect(new AbsPath('/base/file1.1').isFile).toBeTruthy()

            p.saveStrSync("new contents")
            expect(p.isFile).toBeTruthy()
            expect(new AbsPath('/base/file1.1').isFile).toBeTruthy()
            expect(new AbsPath('/base/file1.2').isFile).toBeFalsy()

            p.renameToNextVer()
            expect(new AbsPath('/base/file1').isFile).toBeFalsy()
            expect(new AbsPath('/base/file1.1').isFile).toBeTruthy()
            expect(new AbsPath('/base/file1.2').isFile).toBeTruthy()
            expect(new AbsPath('/base/file1.2').contentsLines).toEqual(['new contents'])

        })
    })

    describe("file content", () => {
        test('reading and writing content', () => {

        })
    })

    describe("dir creation and removal", () => {
        test('mkdirs', () => {
            let p = new AbsPath("/l1/l2/l3/l4/l5")
            expect(p.isDir).toBeFalsy()
            expect(() => { p.mkdirs() }).not.toThrow()
            expect(p.parent.toString()).toEqual("/l1/l2/l3/l4")
            expect(p.parent.isDir).toBeTruthy()
            expect(p.isDir).toBeTruthy()

            let f = p.add('file')
            f.saveStrSync('contents')

            let p2 = new AbsPath("/l1/l2/l3/l4/l5/file/l6")
            expect(() => { p2.mkdirs() }).toThrow(/exists and is not a directory/)
        })

        test('mkdirs via symlink', () => {
            let p = '/link1/dir111/dir1111'
            expect(new AbsPath(p).exists).toBeFalsy()
            expect(() => { new AbsPath(p).mkdirs() }).not.toThrow()
            expect(new AbsPath(p).isDir).toBeTruthy()
        })

        test('mkdirs to illegal path', () => {
            let p = '/base/file1/d1'
            expect(new AbsPath(p).exists).toBeFalsy()
            expect(() => { new AbsPath(p).mkdirs() }).toThrow()
            expect(new AbsPath(p).exists).toBeFalsy()
        })
        test('mkdirs to illegal path via symlink', () => {
            let p = '/link2/d1'
            expect(new AbsPath(p).exists).toBeFalsy()
            expect(() => { new AbsPath(p).mkdirs() }).toThrow()
            expect(new AbsPath(p).exists).toBeFalsy()
        })

        test('rmrfdir', () => {
            let p = new AbsPath('/base')
            expect(p.exists).toBeTruthy()

            expect(() => { p.rmrfdir(/not_base/, true) }).toThrow(/does not match/)
            expect(() => { p.rmrfdir(/^\/base/, true) }).not.toThrow()
            expect(p.exists).toBeFalsy()
        })
    })
})






