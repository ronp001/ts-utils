import * as path from 'path'
import * as fs from 'fs'
import * as _ from 'lodash'
var isBinaryFile = require("isbinaryfile")

/**
 * An immutable path object with utility methods to navigate the filesystem, get information and perform 
 * operations on the path (read,write,etc.)
 */
export class AbsPath {

    //------------------------------------------------------------
    // Factory Methods
    //------------------------------------------------------------

    /**
     * create an absolute path from a string
     * 
     * @param pathseg - if an absolute path, ignores basedir
     *                  if relative path, uses basedir as reference point
     * @param basedir - if null: uses process.cwd() as basedir
     */
    public static fromStringAllowingRelative(pathseg: string | null = null, basedir: string | null = null): AbsPath {
        if (basedir == null) {
            basedir = process.cwd()
        }
        if (pathseg) {
            if (path.isAbsolute(pathseg)) {
                return new AbsPath(pathseg)
            } else {
                return new AbsPath(path.join(basedir, pathseg))
            }
        } else {
            return new AbsPath(basedir)
        }
    }

    /**
     * @param filepath starting point
     * 
     * @returns array with an AbsPath object for each containing directory
     */
    public static dirHierarchy(filepath: string): Array<AbsPath> {
        return new AbsPath(filepath).dirHierarchy
    }

    //------------------------------------------------------------
    // Path Functions
    //------------------------------------------------------------

    public readonly abspath: string | null

    /**
     * 
     * @param from a string or AbsPath specifying an absolute path, or null
     */
    constructor(from: string | null | undefined | AbsPath) {
        if (from == null || typeof from == "undefined") {
            this.abspath = null
        } else if (from instanceof AbsPath) {
            this.abspath = from.abspath
        } else {
            if (path.isAbsolute(from)) {
                this.abspath = path.normalize(from)
            } else {
                this.abspath = path.normalize(path.join(process.cwd(), from))
            }
        }
    }

    /**
     * @returns normalized absolute path.  returns "" if no path set
     */
    public toString(): string {
        if (this.abspath == null) return ""
        return this.abspath
    }

    /**
     * @return the basename of the path
     */
    public get basename(): string {
        if (this.abspath == null) return ""
        return path.basename(this.abspath)
    }

    /**
     * @param other 
     * @param must_be_contained_in_other 
     * 
     * @returns the relative path to get to this path from other
     */
    public relativeFrom(other: AbsPath, must_be_contained_in_other: boolean = false): string | null {
        if (this.abspath == null) return null
        if (other.abspath == null) return null

        if (must_be_contained_in_other) {
            if (!this.abspath.startsWith(other.abspath)) return null
        }
        let result = path.relative(other.abspath, this.abspath)
        if (result == "") {
            if (this.isDir) {
                result = "."
            }
        }
        return result
    }

    /**
     * 
     * @param other 
     * @param must_be_contained_in_other 
     *
     * @returns the relative path to get to the other path from this path
     */
    // public relativeTo(other: AbsPath, must_be_contained_in_other: boolean = false): string | null {
    //     return other.relativeFrom(this)
    // }

    /**
     * @returns true if path is set, false if it is null
     */
    public get isSet(): boolean {
        return (this.abspath != null)
    }

    /**
     * 
     * @param filepath path segment to add
     * 
     * @returns filepath with the additional segment
     */
    public add(filepath: string): AbsPath {
        if (this.abspath == null) return this
        return new AbsPath(path.join(this.abspath, filepath.toString()))
    }

    /**
     * @returns AbsPath of the parent dir. If path is root, returns AbsPath of root.
     */
    public get parent(): AbsPath {
        if (this.abspath == null) return this
        let parent_dir = path.dirname(this.abspath)
        return new AbsPath(parent_dir)
    }

    //------------------------------------------------------------
    // Recognition
    //------------------------------------------------------------

    /**
     * @returns true if root directory of the filesystem, false otherwise
     */
    public get isRoot(): boolean {
        if (this.abspath == null) return false
        return (this.abspath == path.parse(this.abspath).root)
    }

    /**
     * @returns true if path is found in the filesystem, false otherwise
     */
    public get exists(): boolean {
        if (this.abspath == null) return false
        try {
            fs.lstatSync(this.abspath)
            return true
        } catch (e) {
            return false
        }
    }

    /**
     * @returns true if a normal file, false otherwise
     */
    public get isFile(): boolean {
        if (this.abspath == null) return false
        try {
            return fs.lstatSync(this.abspath).isFile()
        } catch (e) {
            return false
        }
    }

    /**
     * @returns true if a directory, false otherwise
     */
    public get isDir(): boolean {
        if (this.abspath == null) return false
        try {
            return fs.lstatSync(this.abspath).isDirectory()
        } catch (e) {
            return false
        }
    }

    /**
     * @returns true if a symbolic link, false otherwise
     */
    public get isSymLink(): boolean {
        if (this.abspath == null) return false
        try {
            return fs.lstatSync(this.abspath).isSymbolicLink()
        } catch (e) {
            return false
        }
    }

    /**
     * see https://www.npmjs.com/package/isbinaryfile
     * 
     * @returns true if the file is binary, false otherwise
     */
    public get isBinaryFile(): boolean {
        if (this.abspath == null) return false
        if (!this.isFile) return false

        return isBinaryFile.sync(this.abspath);
    }


    //------------------------------------------------------------
    // Directory Contents
    //------------------------------------------------------------

    /**
     * @returns true if contains a file of the given name, false otherwise
     */
    public containsFile(filename: string) {
        if (this.abspath == null) return false;
        return this.add(filename).isFile
    }

    /**
     * @returns true if contains a directory of the given name, false otherwise
     */
    public containsDir(filename: string) {
        if (this.abspath == null) return false;
        return this.add(filename).isDir
    }

    /**
     * scans upwards from the current path, looking for a file or directory with a given name
     * @param filename the fs entry to search for
     * @param can_be_dir if false, will only look for regular files.  if true, will look for directories as well.
     * @returns true if found, false if not
     */
    public findUpwards(filename: string, can_be_dir: boolean = false): AbsPath {
        for (let dir of this.dirHierarchy) {
            if (dir.containsFile(filename)) {
                return dir.add(filename);
            } else if (can_be_dir && dir.containsDir(filename)) {
                return dir.add(filename);
            }
        }
        return new AbsPath(null);
    }

    /**
     * @returns an array of AbsPath objects, each one pointing to a containing directory
     */
    public get dirHierarchy(): Array<AbsPath> {
        let current: AbsPath = this
        let result: Array<AbsPath> = []
        let allowed_depth = 30
        do {
            result.push(current)
            current = current.parent
        } while (allowed_depth-- > 0 && !current.isRoot && current.abspath != current.parent.abspath)
        result.push(current.parent)

        return result
    }

    //------------------------------------------------------------
    // Symbolic Link Processing
    //------------------------------------------------------------

    /**
     * @returns an AbsPath pointing to the target of the symbolic link
     */
    public get symLinkTarget(): AbsPath {
        if (this.abspath == null) return this
        if (!this.isSymLink) return this
        return new AbsPath(fs.readlinkSync(this.abspath).toString())
    }

    /**
     * @returns an AbsPath with symbolic links completely resolved
     */
    public get realpath(): AbsPath {
        if (this.abspath == null) return this

        return new AbsPath(fs.realpathSync(this.abspath))
    }


    //------------------------------------------------------------
    // File Contents
    //------------------------------------------------------------

    /**
     * @returns file contents as an array of strings
     */
    public get contentsLines(): Array<string> {
        return this.contentsString.split('\n')
    }

    /**
     * @returns file contents as an array of strings
     */
    public get contentsString(): String {
        if (this.abspath == null || !this.isFile) return ""
        return fs.readFileSync(this.abspath, 'utf8')
    }

    /**
     * @returns file contents as a buffer object
     */
    public get contentsBuffer(): Buffer {
        if (this.abspath == null || !this.isFile) return Buffer.alloc(0)

        return fs.readFileSync(this.abspath)
    }

    /**
     * @returns parsed contents of a JSON file or null if not a JSON file
     */
    public get contentsFromJSON(): Object | null {
        if (this.abspath == null || !this.isFile) return null
        let buf = this.contentsBuffer
        try {
            return JSON.parse(buf.toString())
        } catch (e) {
            return null
        }
    }

    /**
     * store new contents in the file
     * 
     * @param contents a string with the new contents
     */
    public saveStrSync(contents: string) {
        if (this.abspath == null) {
            throw new Error("can't save - abspath is null")
        }
        try {
            this.parent.mkdirs()
        } catch (e) {
            throw new Error(`can't save ${this.toString()} - ${e.message}`)
        }
        fs.writeFileSync(this.abspath, contents)
    }

    //------------------------------------------------------------
    // Directory contents and traversal
    //------------------------------------------------------------

    /**
     * @returns an array of AbsPath objects corresponding to each entry in the directory
     * or null if not a directory
     */
    public get dirContents(): Array<AbsPath> | null {
        if (this.abspath == null) return null
        if (!this.isDir) return null

        let result: Array<AbsPath> = []

        for (let entry of fs.readdirSync(this.abspath)) {
            result.push(this.add(entry))
        }
        return result
    }

    /**
     * Traverse the directory hierarchy and activate a callback for each entry.
     * 
     * The hierarchy is traversed twice: first down, then up, allowing the callback
     * function to accumulate data on the way down and perform operations on the way up.
     * 
     * Aborts the traversal if the callback function returns true
     * 
     * @param fn callback to activate
     */
    public foreachEntryInDir(fn: (entry: AbsPath, traversal_direction: "down" | "up" | null) => boolean | void): boolean {
        let entries = this.dirContents
        if (entries == null) return true

        for (let entry of entries) {
            if (entry.isDir) {
                let abort
                abort = fn(entry, "down")
                if (abort) return true
                abort = entry.foreachEntryInDir(fn)
                if (abort) return true
                abort = fn(entry, "up")
                if (abort) return true
            } else {
                let abort = fn(entry, null)
                if (abort) return true
            }
        }
        return false
    }


    //------------------------------------------------------------
    // Modifying the filesystem
    //------------------------------------------------------------

    public renameTo(new_name: string) {
        if (this.abspath == null) return
        if (!this.exists) return

        fs.renameSync(this.abspath, new_name)
    }

    public unlinkFile() {
        this.rmFile()
    }

    public rmFile() {
        if (this.abspath == null) {
            throw new Error(`rmFile - path is not set`)
        }
        if (!this.isFile) {
            throw new Error(`rmFile - {$this.filepath} is not a file`)
        }
        fs.unlinkSync(this.abspath)
    }

    //------------------------------------------------------------
    // Directory creation and removal
    //------------------------------------------------------------

    public mkdirs() {
        if (this.abspath == null) throw new Error("can't mkdirs for null abspath")
        if (this.exists) return
        if (this.isRoot) return

        let parent = this.parent
        if (parent.exists && !parent.isDir && !parent.isSymLink) {
            throw new Error(`${parent.toString()} exists and is not a directory or symlink`)
        } else {
            parent.mkdirs()
        }

        fs.mkdirSync(this.parent.realpath.add(this.basename).toString())
    }

    public rmrfdir(must_match: RegExp, remove_self: boolean = false) {
        if (this.abspath == null) return
        if (!this.isDir) return
        if (remove_self && !this.abspath.match(must_match)) {
            throw new Error(`${this.abspath} does not match ${must_match} - aborting delete operation`)
        }
        this.foreachEntryInDir((p: AbsPath, direction: "down" | "up" | null) => {
            if (p.abspath == null) return
            if (!p.abspath.match(must_match)) {
                throw new Error(`${p.abspath} does not match ${must_match} - aborting delete operation`)
            }
            if (direction == "up" || direction == null) {
                if (p.isDir) {
                    fs.rmdirSync(p.abspath)
                } else {
                    fs.unlinkSync(p.abspath)
                }
            }
        })
        if (remove_self) {
            fs.rmdirSync(this.abspath)
        }
    }


    //------------------------------------------------------------
    // File version naming
    //
    // (assumes a numeric suffix describing the version
    //  e.g:  "myfile.txt.3" is version 3 of "myfile.txt")
    //
    // Useful for keeping a backup of a file before modifying it.
    //------------------------------------------------------------

    public get maxVer(): number | null {
        let existing_versions = this.existingVersions
        if (existing_versions == null) return null

        let max: number | undefined = _.max(existing_versions)

        if (max == undefined) return null
        return max
    }

    public renameToNextVer(): string {
        let current_max_ver: number | null = this.maxVer

        let newname: string
        if (current_max_ver == null) {
            newname = this.abspath + ".1"
        } else {
            newname = this.abspath + `.${current_max_ver + 1}`
        }
        this.renameTo(newname)
        return newname
    }

    public get existingVersions(): number[] | null {
        if (this.abspath == null) return null
        if (!this.exists) return null

        let regex = new RegExp(`${this.abspath}\.([0-9]+)`)
        let existing = this.parent.dirContents
        let matching: Array<number | null> = _.map(existing, (el: AbsPath) => {
            let matches = el.toString().match(regex)
            if (matches == null) return null
            return parseInt(matches[1])
        })

        let nums: number[] = _.filter(matching, (e) => { return e != null }) as number[]

        return _.sortBy(nums)
    }

}