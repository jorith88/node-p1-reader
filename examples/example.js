const P1Reader = require('../main');
const fs = require('fs');

let config = {
    port: '/dev/ttyUSB0',
    baudRate: 9600,
    parity: "even",
    dataBits: 7,
    stopBits: 1
};

// Enable Debug Mode by uncommenting the line below
config.debug = true;

// Enable Emulator Mode by uncommenting the line below
// config.emulator = true;

// Optionally override certain emulator parameters if Emulator Mode is enabled by uncommenting the lines below
// config.emulatorOverrides = {
//     electricityOffset: 100,
//     electricityIncrement: 0.500,
//     gasOffset: 50,
//     gasIncrement: 0.100,
//     interval: 1,
//     intervalGas: 3 // Must be larger than 'interval'
// };

const p1Reader = new P1Reader(config);

p1Reader.on('connected', () => {
    console.log('Connection with the Smart Meter has been established!');
});

p1Reader.on('reading', data => {
    console.log('Reading received: currently consuming ' + data.electricity.received.actual.reading + data.electricity.received.actual.unit);

    // Write electricity totals and actual value to CSV
    const csvOutput = '' +
        data.timestamp + ';' +
        data.electricity.received.tariff1.reading + ';' +
        data.electricity.received.tariff2.reading + ';' +
        data.electricity.received.actual.reading + ';' +
        data.electricity.tariffIndicator + ';' +
        data.electricity.numberOfPowerFailures + ';' +
        data.electricity.numberOfLongPowerFailures + ';' +
        data.gas.timestamp + ';' +
        data.gas.reading + '\n';

    fs.appendFile('p1-reader-log.csv', csvOutput, err => {});
});

p1Reader.on('reading-raw', data => {
    // If you are interested in viewing the unparsed data that was received at the serial port uncomment the line below
    // console.log(data);
});

p1Reader.on('error', error => {
    console.log(error);
});

p1Reader.on('close', () => {
    console.log('Connection closed');
});

// Handle all uncaught errors without crashing
process.on('uncaughtException', error => {
    console.error(error);
});