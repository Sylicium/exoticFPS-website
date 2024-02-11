/**
 * @version 3.3.2 // 11/11/2023
 * @author Sylicium
 * @description Module de serveur qui gère un site web, une api.
 *
*/

// Dependancies: express http socket.io fs axios

/*
How to use ?

create 2 folders:
- /site
- /api
the site will be the root of your website. Thats means: domain.com/index.html refers to -> /site/index.html.

For the api the arborescences is:
/api
    /apiVersion
        /METHOD
            - endpoint.js
            /somedirectory
                - someOtherEndpoint.js

// Here's an example:
For the api the arborescences is:
/api
├───/test
│   ├───/GET
│   │   │   test.js
│   │   │
│   │   └───/datas
│   │           retrieve.js
│   │
│   └───/POST
│       │   test.js
│       │
│       └───datas
│               send.js
│
└───/last
    ├───/GET
    │   │   test.js
    │   │
    │   └───/datas
    │           check.js
    │           retrieve.js
    └───/POST
        │   test.js
        │   test2.js
        │
        └───/datas
            └───/send
                    csv.js
                    json.js

This directory structure is making 2 api versions:
version 'v1': domain.com/api/v1
    GET /test (so full url is: domain.com/api/v1/test)
    GET /datas/retrieve
    POST /test
    POST /datas/send
version 'last': domain.com/api/last
    GET /test
    GET /datas/retrieve
    GET /datas/check
    POST /test
    POST /test2
    POST /datas/send/json
    POST /datas/send/csv
    PATCH /datas/refresh
*/



/*
//  Endpoint sample:

module.exports = {
    bodyParameters: [
        { name: "url", required: false, type: "string", msg: "L'URL a fetch"}
    ],
    func: (Modules_, req, res) => {
        
        Modules_.axios.get(req.body.url).then(msg => {
            return res.send({
                status: 200
            })
        }).catch(e => {
            return res.send({
                status: 500,
                error: `${e}`,
                stack: e.stack.split("\n")
            })
        })
        
    } // end func
}
*/

const CONFIG = require("./config")

let config = {
    server: {
        port: CONFIG.website.port,
    },
    api: {
        useIndexOnDirectory: true // Default true | If true, when a requests ends by a '/', the call is actually made on '/index' E.g: '/api/v1/test/' -> same as -> '/api/v1/test/index' (WARNING! '/api/v1/test' is a different endpoint)
    }
}

let servEndpoints = {
    api: {
        fs: "/api", // chemin depuis le root du projet et sans le slash de fin
        relative: "/api", // chemin relatif par rapport à ce fichier
    },
    site: {
        fs: "/site", // chemin depuis le root du projet et sans le slash de fin
        relative: "/site", // chemin relatif par rapport à ce fichier
    }
}

let Logger;
try {
    let Logger_temp = require("./localModules/logger")
    Logger = Logger_temp()
} catch(e) { Logger = console }

const axios = require("axios")
const fs = require("fs")
const express = require('express');
// const bodyParser = require('body-parser');
const app = express(); // Uncaught (in promise) TypeError: Failed to execute 'fetch' on 'Window': Request with GET/HEAD method cannot have body.
app.use(express.urlencoded())
app.use(express.json())
//app.use(bodyParser.json({ type: 'application/*+json' }))
const serv = require('http').createServer(app);
const io = require('socket.io')(serv);

const Modules_ = {
    "app": app,
    "config": config,
    "axios": axios
}

let Temp_ = {
    totalAPIEventsCount_total: 0,
}

/*
param types:
string - pour du texte
object - dictionnaire { }
array - liste []
number - Nombre entier ou flotant
boolean - true/false

*/

let APIEvents = {}
let APIVersionsList = () => { return Object.keys(APIEvents) }
let APIVersionsList_totalTriedToLoad = 0

function loadAPIendpointsOfRelativePath(relative_dirPath_method, datas, subPath=undefined) {
    /*
    datas = {
        api_version: api_version,
        method: method,
        directoryName_version: directoryName_version,
        directoryName_method: directoryName_method
    }
    */
    fs.readdirSync(`.${servEndpoints.api.fs}${relative_dirPath_method}${subPath ?? ""}`).forEach(file => {
        try {
            //console.log('`.${servEndpoints.api.fs}${relative_dirPath_method}${subPath ?? ""}`',`.${servEndpoints.api.fs}${relative_dirPath_method}${subPath ?? ""}`)
            //console.log('subPath',subPath)
            if(fs.lstatSync(`.${servEndpoints.api.fs}${relative_dirPath_method}${subPath ?? ""}/${file}`).isDirectory()) {
                return loadAPIendpointsOfRelativePath(relative_dirPath_method, datas, `${subPath ?? ""}/${file}`);
            }
            Temp_.totalAPIEventsCount_total++
            let the_require = require(`.${servEndpoints.api.fs}${relative_dirPath_method}${subPath ?? ""}/${file}`)
            if(!the_require.func || typeof the_require.func != "function") throw new Error(`Required file is empty or no function is set. Cannot import empty API endpoint.`)
            let fileName = file.split(".")
            fileName.pop()
            fileName = fileName.join(".")
            let endpoint = (subPath ?? "") + "/" + fileName
            APIEvents[datas.api_version].push({
                method: datas.method,
                endpoint: endpoint,
                require: the_require,
            })
            console.log(`[API]   ✔ Loaded API endpoint (${datas.method}) ${endpoint}`)
        } catch(e) {
            console.log(`[API]   ❌ Failed loading API endpoint (${datas.method}) ${subPath ?? ""}/${file}     (${e})`)
        }
    })
}









console.log(`[API] Loading APIEvents...`)
fs.readdirSync(`.${servEndpoints.api.fs}/`).forEach(directoryName_version => {
    let dirPath_version = `.${servEndpoints.api.fs}/${directoryName_version}`
    try {
        if( fs.existsSync(dirPath_version) && fs.lstatSync(dirPath_version).isDirectory() ) {
            let api_version = directoryName_version
            APIEvents[api_version] = []
            console.log(`[API] Loading api endpoints for version '${directoryName_version}' ...`)


            fs.readdirSync(`.${servEndpoints.api.fs}/${directoryName_version}/`).forEach(directoryName_method => {
                let relative_dirPath_method = `/${directoryName_version}/${directoryName_method}`
                try {
                    if( fs.existsSync(`.${servEndpoints.api.fs}${relative_dirPath_method}`) && fs.lstatSync(`.${servEndpoints.api.fs}${relative_dirPath_method}`).isDirectory() ) {
                        let method = directoryName_method.toUpperCase()
                        // console.log(`[API][${api_version}]   Loading api endpoints for method ${method} ...`)
                        loadAPIendpointsOfRelativePath(relative_dirPath_method, {
                            api_version: api_version,
                            method: method,
                            directoryName_version: directoryName_version,
                            directoryName_method: directoryName_method
                        })
                    } else {
                        console.log(`[API]   ! ${directoryName_method} is a file, not a directory`)
                    }
                } catch(e) {
                    console.log(`[API][${api_version}][ERROR] ❌`,e)
                }
            
            })
            console.log(`[API]   ✅ Loaded ${APIEvents[api_version].length} APIEvents for API version '${api_version}':`,APIEvents[api_version])



        } else {
            console.log(`[API]   ! ${directoryName} is a file, not a directory`)
        }
    } catch(e) {
        console.log(`[API][ERROR] ❌`,e)
    }

})

Temp_.totalAPIEventsCount_loaded = 0
Object.keys(APIEvents).forEach((key, index) => {
    try { Temp_.totalAPIEventsCount_loaded += APIEvents[key].length } catch(e) { console.log(e) }
})
console.log(`[API] ✅ Loaded ${Object.keys(APIEvents).length} API versions, loading successfully ${Temp_.totalAPIEventsCount_loaded}/${Temp_.totalAPIEventsCount_total} endpoints:`,APIEvents)


module.exports.run = () => {

    
    app.all("*", async (req, res) => { // tout à la fin sinon le "*" catch à la place des autres app.get()

        try {
            
            if(req.path.startsWith("/assets/")) { return res.sendFile(`${__dirname}${servEndpoints.site.relative}${req.path}`) }
            if(req.path.startsWith("/api/")) { return await handleAPI(req, res) }

            console.log(`[Web] ${req.method.toUpperCase()} -> ${req.url}`)
            // console.log(req.query)
    
            if(req.path == "/favicon.ico") return res.sendFile(`${__dirname}${servEndpoints.site.relative}/favicon.ico`)
            if(req.path.startsWith("/api/")) return;
            if(req.path.startsWith("/assets/")) return;
    
            if(req.path.endsWith("/") && fs.existsSync(`.${servEndpoints.site.fs}${req.path}/index.html`)) {
                return res.sendFile(`${__dirname}${servEndpoints.site.relative}${req.path}/index.html`)
            } else if(fs.existsSync(`.${servEndpoints.site.fs}${req.path}.html`)) {
                return res.sendFile(`${__dirname}${servEndpoints.site.relative}${req.path}.html`)
            } else {
                return res.sendFile(`${__dirname}${servEndpoints.site.relative}/404.html`)
            }

        } catch(err) {
            res.status(500)
            res.send(JSON.stringify({
                message: `An error occured server-side. ${err}`,
                stack: err.stack.split("\n"),
            }))
        }

    })

    serv.listen(config.server.port, () => {
        console.log(`[server.js] Serveur démarré sur le port ${config.server.port}`)
    })

}



async function handleAPI(req, res) {

    console.log("req.query:",req)

    let pathArgs = req.path.split("/").filter(Boolean)
    let endpoint;
    let version = pathArgs.length >= 2 ? pathArgs[1] : undefined
    if(!version) return res.send({ status: 400, message: `API version not specified in request` })

    if(pathArgs[0] != "api") { endpoint = undefined }
    else { endpoint = req.path.substr(1+3+1 + version.length, req.path.length) } // slice on "domain.com/api/<version>/<multiple>/<paths>/<endpoint>" to get "/<multiple>/<paths>/<endpoint>"

    if(!APIEvents.hasOwnProperty(version)) return res.send({ status: 400, message: `Invalid API version not specified in request. Versions are: ${APIVersionsList().join(", ")}` })

    if(config.api.useIndexOnDirectory) {
        if(endpoint.endsWith("/")) return res.redirect(301, `${req.url.replace(`${req.path}`,`${req.path}index`)}`)
    }

    let apiEvent_allMethod = APIEvents[version].filter((item) => {
        return (endpoint == item.endpoint)
    })
    if(apiEvent_allMethod.length == 0) return res.send({ status: 404, message: `Endpoint does not exists`  })


    let allMethodsAllowed = apiEvent_allMethod.map((item) => { return item.method.toUpperCase() })
    if(!allMethodsAllowed.includes(req.method.toUpperCase())) return res.send({
        status: 405,
        message: `Method not allowed`,
        methods: allMethodsAllowed
    })

    let apiEvent = apiEvent_allMethod.find(x => x.method.toUpperCase() == req.method.toUpperCase())?.require ?? undefined
    if(!apiEvent) return res.send({
        status: 500,
        message: `Error EVENT#01`,
        methods: allMethodsAllowed
    })

    for(let i in apiEvent.bodyParameters) {
        let param = apiEvent.bodyParameters[i]
        if(!req.body.hasOwnProperty(param.name) && param.required) {
            return res.send({
                status: 400,
                message: `Bad request. Missing parameter: '${param.name}'. ${param.msg || ""}`,
                bodyParameters: apiEvent.bodyParameters
            })
        } else if(req.body.hasOwnProperty(param.name)) {
            try {
                if(param.type == "array") {
                    if(!Array.isArray(req.body[param.name])) {
                        return res.send({
                            status: 400,
                            message: `Bad request. Invalid parameter type: '${param.name}'. ${param.msg || ""}`,
                            parameters: apiEvent.bodyParameters
                        })
                    }
                } else if(typeof req.body[param.name] != param.type) {
                    return res.send({
                        status: 400,
                        message: `Bad request. Invalid parameter type: '${param.name}'. ${param.msg || ""}`,
                        parameters: apiEvent.bodyParameters
                    })
                }
            } catch(e) {
                Logger.error(e)
                return res.send({
                    status: 500,
                    message: `Internal server error while parsing body parameter '${param.name}' (type:${param.type} | required:${param.required}).`,
                    error: `${e}`,
                    stack: e.stack.split("\n")
                })
            }
        }
    }

    try {
        await apiEvent.func(Modules_, req, res)
    } catch(err) {
        return res.send({
            status: 500,
            message: `Internal server error while executing request.`,
            error: `${err}`,
            stack: err.stack.split("\n")
        })
    }
}


io.on('connection', socket => {

    console.log(`[socket][+] New connection: ${socket.id}`)

    io.on('disconnect', socket => {
        console.log(`[socket][-] Lost connection: ${socket.id}`)
    })

})