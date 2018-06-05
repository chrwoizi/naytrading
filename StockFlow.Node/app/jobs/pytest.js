var exports = module.exports = {}
var fs = require('fs');
var path = require('path');
var process = require('process');
var { spawn } = require('child_process');
var config = require('../config/envconfig');


function logVerbose(message) {
    console.log(message);
}


function logError(message) {
    console.log(message);
}


function runProcess(executable, cwd, args) {
    return new Promise((resolve, reject) => {
        try {
            var env = Object.create(process.env);
            env.PYTHONIOENCODING = 'utf-8';
            var proc = spawn(executable, args, { cwd: cwd, env: env });
            
            proc.stdout.setEncoding("utf8");
            proc.stderr.setEncoding("utf8");

            proc.stdout.on('data', (data) => {
                var message = "" + data;
                logVerbose(message.substr(0, data.length - 2));
            });

            proc.stderr.on('data', (data) => {
                var message = "" + data;
                logError(message.substr(0, data.length - 2));
            });

            proc.on('close', (code) => {
                if (code == 0) {
                    resolve();
                }
                else {
                    reject("child process exited with code " + code);
                }
            });

            proc.on('error', function (e) {
                reject("child process crashed with " + e);
            });
        }
        catch (e) {
            reject(e);
        }
    });
}


exports.run = async function () {
    try {
        
        var processorsDir = path.resolve(config.processors_dir);
        await runProcess(config.python, processorsDir, [
            "test.py"
        ]);

    }
    catch (error) {
        logError("error in pytest job: " + error);
    }

    setTimeout(exports.run, 10000);
};