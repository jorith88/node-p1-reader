const EventEmitter = require('events');
const util = require('util');
let SerialPort = require('serialport');

let connectedToSmartMeter = false;
let constructor;
let crcCheckRequired = false;

const checkCrc = require('./lib/checkCrc');
const parsePacket = require('./lib/parsePacket');
const debug = require('./lib/debug');
const config = require('./config/config.json');

function P1Reader(options) {
    if (typeof options !== 'object' || options.port == "" || options.baudRate == "" || options.parity == "" || options.dataBits == "" || options.stopBits == "") {
        console.error("Parameters 'port', 'baudRate', 'parity', 'dataBits' and 'stopBit' are required since version 2.x.x to instantiate the module");
    }

    if (options.debug) {
        debug.enableDebugMode();
    }

    // Overwrite serialport module when emulator mode is set
    if (options.emulator) {
        SerialPort = require('./lib/emulateSerialport');
        SerialPort.setEmulatorOverrides(options.emulatorOverrides);
    }

    if (options.crcCheckRequired) {
        crcCheckRequired = options.crcCheckRequired;
    }

    constructor = this; // TODO???????????????????????????????

    EventEmitter.call(this);

    _setupSerialConnection(options.port, options.baudRate, options.parity, options.dataBits, options.stopBits);




//
//    // Either force a specific port (with specific configuration) or automatically discover it
//    if (options && options.serialPort) {
//
//
//        _setupSerialConnection();
//    } else {
//        SerialPort.list()
//            .then(ports => {
//                // Create the auto discovery list with each of the possible serialport configurations per port found
//                for (let i = 0; i < ports.length; i++) {
//                    for (let j = 0; j < config.serialPort.length; j++) {
//                        autodiscoverList.push({
//                            port: ports[i].comName,
//                            baudRate: config.serialPort[j].baudRate,
//                            parity: config.serialPort[j].parity,
//                            dataBits: config.serialPort[j].dataBits,
//                            stopBits: config.serialPort[j].stopBits
//                        });
//                    }
//                }
//
//                debug.logAutodiscoverList(autodiscoverList);
//
//                _setupSerialConnection();
//            })
//            .catch(err => {
//                console.error('Serialports could not be listed: ' + err);
//            });
//    }
}

util.inherits(P1Reader, EventEmitter);

module.exports = P1Reader;

/**
 * Setup serial port connection
 */
function _setupSerialConnection(port, baudRate, parity, dataBits, stopBits) {
    debug.log('Trying to connect to Smart Meter via port: ' + port + ' (BaudRate: ' + baudRate + ', Parity: ' + parity + ', Databits: ' + dataBits + ', Stopbits: ' + stopBits + ')');

    // Open serial port connection
    const sp = new SerialPort(port, {
        baudRate: baudRate,
        parity: parity,
        dataBits: dataBits,
        stopBits: stopBits
    });

    let received = '';

    sp.on('open', () => {
        debug.log('Serial connection established');

        sp.on('data', data => {
            received += data.toString();

            let startCharPos = received.indexOf(config.startCharacter);
            let endCharPos = received.indexOf(config.stopCharacter);

            if (endCharPos >= 0 && endCharPos < startCharPos) {
                received = received.substr(endCharPos + 1);
                startCharPos = -1;
                endCharPos = -1;
            }

            // Package is complete if the start- and stop character are received
            const crcReceived = endCharPos >= 0 && received.length > endCharPos + 4;
            if (startCharPos >= 0 && endCharPos >= 0 && crcReceived) {
                const packet = received.substr(startCharPos, endCharPos - startCharPos);
                const expectedCrc = parseInt(received.substr(endCharPos + 1, 4), 16);
                received = received.substr(endCharPos + 5);

                var crcOk = true;
                if (crcCheckRequired) {
                    crcOk = checkCrc(packet + '!', expectedCrc);
                }

                if (crcOk) {
                    const parsedPacket = parsePacket(packet);

                    received = '';

                    // Emit a 'connected' event when we have actually successfully parsed our first data
                    if (!connectedToSmartMeter && parsedPacket.timestamp !== null) {
                        debug.log('Connection with Smart Meter established');
                        constructor.emit('connected');
                        connectedToSmartMeter = true;
                    }

                    debug.writeToLogFile(packet, parsedPacket);

                    constructor.emit('reading-raw', packet);

                    if (parsedPacket.timestamp !== null) {
                        constructor.emit('reading', parsedPacket);
                    } else {
                        constructor.emit('error', 'Invalid reading');
                    }
                } else {
                    constructor.emit('error', 'Invalid CRC');
                }
            }
        });
    });

    sp.on('error', (error) => {
        debug.log('Error emitted: ' + error);
        constructor.emit('error', error);
    });

    sp.on('close', () => {
        debug.log('Connection closed');
        constructor.emit('close');
    });
}