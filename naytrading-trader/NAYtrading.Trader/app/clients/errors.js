var exports = module.exports = {}

class FatalError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.FatalError = FatalError;

class CancelOrderTemporaryError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.CancelOrderTemporaryError = CancelOrderTemporaryError;

class CancelOrderFatalError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.CancelOrderFatalError = CancelOrderFatalError;

class TanError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.TanError = TanError;
