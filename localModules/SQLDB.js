
const somef = require("./someFunctions")
const Mariadb = require('mariadb');

/**
 * @description Base de donnée SQL
 * @version 2.0.0
 * @date 21/11/2023
 * @author Sylicium
*/

/*
Dependancies:
- someFunctions (Code by Sylicium)
npm install mariadb
*/

let config = { // require("./config")
    database: {
        host: "localhost",
        port: null,
        database: "exotic",
        user: "web_exotic",
        password: process.env.DATABASE_PASSWORD,
        connectionLimit: 100,
    }
}

let Temp_ = {
}


class Database {
    constructor() {
        this._Mariadb = Mariadb
        this._Pool = null;
        this._initialized = false
        this._initializing = false
        this._waitForInit_maxRecursive = 1000 // Default 1000 | Maximum of retry before abandonning. 
        this._waitForInit_waitDelayBetweenTests = 10 // Default 10 | milliseconds
        this._waitForInit_doThrowErrorWhenRecurseExceed = true // Default true | If true, when __waitForInit__ is called and exceeds the maxrecursive value, function throws a new Error() instead of returning false.

        this.socket = new somef.Emitter()

        this._cacheConn = undefined

        /*
        TypeError: Cannot read properties of null (reading 'getConnection')
        -> ajouter __waitForInit__() car la base de donnée n'as pas encore chargée
        */
    }

    async _makeQuery(query, params) {
        let waitInit = await this.__waitForInit__()
        if(!waitInit) return [];
        let conn;
        let queryResponse = undefined
        // logger.debug("this._Pool:",this._Pool)
        try {

            if(this._cacheConn == undefined) {
                this._cacheConn = await this._Pool.getConnection();
            }
            let conn = this._cacheConn
            
            let queryRes = await conn.query(query, params)

            queryResponse = queryRes
        } catch (err) {
            console.log("error",err)
            throw err;
        } finally {
            if (conn) conn.release()
            return queryResponse
        }
    }

    async __init__() {
        if(this._initialized) throw new Error(`[SQLDB][w] Cannot init Database again. Database has already been initialized.`)
        if(this._initializing) throw new Error(`[SQLDB][w] Cannot init Database. Database is currently initializing.`)
        this._initializing = true
        try {
            /*{
                host: config.database.host, 
                user: config.database.user,
                password: config.database.password,
                database: config.database.database,
                connectionLimit: config.database.connectionLimit
            }*/
            let payload = {}
            if(config.database.host != null) payload.host = config.database.host; 
            if(config.database.user != null) payload.user = config.database.user; 
            if(config.database.password != null) payload.password = config.database.password; 
            if(config.database.database != null) payload.database = config.database.database; 
            if(config.database.connectionLimit != null) payload.connectionLimit = config.database.connectionLimit; 
            const pool = await this._Mariadb.createPool(payload)
            this._Pool = await pool
            this._initialized = true
            this._initializing = false
    
            this.socket.emit('ready', (
                true
            ))
        } catch(e) {
            console.log(e)
            this._initializing = false
            this.socket.emit('ready', (
                false,
                e
            ))
        }
        //console.log("init this._Pool2:",this._Pool)
    }

    async __waitForInit__() {
        let c = 0;
        if(this._initialized) {
            return true
        } else {
            c++
            if(c > this._waitForInit_maxRecursive) {
                if(this._waitForInit_doThrowErrorWhenRecurseExceed) { throw new Error(`[SQLDB][!] Error thrown due to retry time and amount exeeding set values in config.`) }
                else { return false }
            }
            await somef.sleep(this._waitForInit_waitDelayBetweenTests);
            return this.__waitForInit__()
        }
    }

    __get__() { return this }

}

let Database_ = new Database()

module.exports = Database_

Database_.socket.on("ready", (status, error) => {
    if(error) throw error
    if(!status) return console.log("[SQLDB][i] ready status not ok.")
    console.log("[SQLDB][i] Database loaded.")
})