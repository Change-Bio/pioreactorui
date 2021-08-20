const { execFile } = require("child_process");


process.on('message', function(data) {
    var ipAddressArgs = data.ipAddress === "" ? [] : ["--ip", data.ipAddress]

    execFile("pio", ["add-pioreactor", data.newPioreactorName].concat(ipAddressArgs),
        { shell: "/bin/bash" },
        (error, stdout, stderr) => {
        if (error) {
            console.log(error)
            process.send({result: false, msg: stderr});
        } else {
            process.send({result: true, msg: ""});
        }
        process.exit(0)
    });
});