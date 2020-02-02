var pixelix = pixelix | {};

pixelix = {
    ws: {}
};

pixelix.ws.Client = function(options) {

    this.socket     = null;
    this.cmdQueue   = [];
    this.pendingCmd = null;

    this._sendCmdFromQueue = function() {
        var msg = "";

        if (0 < this.cmdQueue.length) {
            this.pendingCmd = this.cmdQueue.shift();

            msg = this.pendingCmd.name;

            if (null !== this.pendingCmd.par) {
                msg += ";" + this.pendingCmd.par;
            }

            console.info("Websocket command: " + msg);
            this.socket.send(msg);
        }
    };

    this._sendCmd = function(cmd) {

        this.cmdQueue.push(cmd);

        if (null === this.pendingCmd) {
            this._sendCmdFromQueue();
        }
    };
};

pixelix.ws.Client.prototype.connect = function(options) {
    return new Promise(function(resolve, reject) {
        var wsUrl;

        if (("string" !== typeof options.protocol) ||
            ("string" !== typeof options.hostname) ||
            ("number" !== typeof options.port) ||
            ("string" !== typeof options.endpoint)) {

            reject();
        } else {

            try {
                wsUrl = options.protocol + "://" + options.hostname + ":" + options.port + options.endpoint;
                this.socket = new WebSocket(wsUrl);

                this.socket.onopen = function(openEvent) {
                    console.debug("Websocket opened.");
                    resolve(this);
                }.bind(this);

                this.socket.onclose = function(closeEvent) {
                    console.debug("Websocket closed.");
                    if ("function" === typeof options.onClosed) {
                        options.onClosed();
                    }
                };

                this.socket.onmessage = function(messageEvent) {
                    console.debug("Websocket message: " + messageEvent.data);
                    this._onMessage(messageEvent.data);
                }.bind(this);

            } catch (exception) {
                console.error(exception);
                reject();
            }
        }
    }.bind(this));
};

pixelix.ws.Client.prototype._onMessage = function(msg) {
    var data    = msg.split(";");
    var status  = data.shift();
    var rsp     = {};
    var index   = 0;

    if (null === this.pendingCmd) {
        console.error("No pending command, but response received.");
    } else if ("ACK" === status) {
        if ("GETDISP" === this.pendingCmd.name) {
            rsp.slotId = data.shift();
            rsp.data = data;
            this.pendingCmd.resolve(rsp);
        } else if ("BRIGHTNESS" === this.pendingCmd.name) {
            rsp.brightness = parseInt(data[0]);
            rsp.automaticBrightnessControl = (1 === parseInt(data[1])) ? true : false;
            this.pendingCmd.resolve(rsp);
        } else if ("INSTALL" === this.pendingCmd.name) {
            rsp.slotId = parseInt(data[0]);
            this.pendingCmd.resolve(rsp);
        } else if ("PLUGINS" === this.pendingCmd.name) {
            rsp.plugins = [];
            for(index = 0; index < data.length; ++index) {
                rsp.plugins.push(data[index].substring(1, data[index].length - 1));
            }
            this.pendingCmd.resolve(rsp);
        } else if ("RESET" === this.pendingCmd.name) {
            this.pendingCmd.resolve(rsp);
        } else if ("SLOTS" === this.pendingCmd.name) {
            rsp.maxSlots = parseInt(data.shift());
            rsp.slots = [];
            for(index = 0; index < data.length; ++index) {
                rsp.slots.push(data[index].substring(1, data[index].length - 1));
            }
            this.pendingCmd.resolve(rsp);
        } else if ("UNINSTALL" === this.pendingCmd.name) {
            this.pendingCmd.resolve(rsp);
        } else {
            console.error("Unknown command: " + this.pendingCmd.name);
            this.pendingCmd.reject();
        }
    } else {
        console.error("Command " + this.pendingCmd.name + " failed.");
        this.pendingCmd.reject();
    }

    this.pendingCmd = null;
    this._sendCmdFromQueue();

    return;
};

pixelix.ws.Client.prototype.getDisplayContent = function() {
    return new Promise(function(resolve, reject) {
        if (null === this.socket) {
            reject();
        } else {
            this._sendCmd({
                name: "GETDISP",
                par: null,
                resolve: resolve,
                reject: reject
            });
        }
    }.bind(this));
};

pixelix.ws.Client.prototype.getSlots = function() {
    return new Promise(function(resolve, reject) {
        if (null === this.socket) {
            reject();
        } else {
            this._sendCmd({
                name: "SLOTS",
                par: null,
                resolve: resolve,
                reject: reject
            });
        }
    }.bind(this));
};

pixelix.ws.Client.prototype.reset = function() {
    return new Promise(function(resolve, reject) {
        if (null === this.socket) {
            reject();
        } else {
            this._sendCmd({
                name: "RESET",
                par: null,
                resolve: resolve,
                reject: reject
            });
        }
    }.bind(this));
};

pixelix.ws.Client.prototype.getBrightness = function() {
    return new Promise(function(resolve, reject) {
        if (null === this.socket) {
            reject();
        } else {
            this._sendCmd({
                name: "BRIGHTNESS",
                par: null,
                resolve: resolve,
                reject: reject
            });
        }
    }.bind(this));
};

pixelix.ws.Client.prototype.setBrightness = function(options) {
    return new Promise(function(resolve, reject) {
        var par = "";

        if (null === this.socket) {
            reject();
        } else if ("number" !== typeof options.brightness) {
            reject();
        } else {

            par += options.brightness;

            if ("boolean" === typeof options.automaticBrightnessControl) {
                par += ";";
                par += options.automaticBrightnessControl;
            }

            this._sendCmd({
                name: "BRIGHTNESS",
                par: par,
                resolve: resolve,
                reject: reject
            });
        }
    }.bind(this));
};

pixelix.ws.Client.prototype.getPlugins = function() {
    return new Promise(function(resolve, reject) {
        if (null === this.socket) {
            reject();
        } else {
            this._sendCmd({
                name: "PLUGINS",
                par: null,
                resolve: resolve,
                reject: reject
            });
        }
    }.bind(this));
};

pixelix.ws.Client.prototype.install = function(options) {
    return new Promise(function(resolve, reject) {
        if (null === this.socket) {
            reject();
        } else if ("string" !== typeof options.pluginName) {
            reject();
        } else {
            this._sendCmd({
                name: "INSTALL",
                par: "\"" + options.pluginName + "\"",
                resolve: resolve,
                reject: reject
            });
        }
    }.bind(this));
};

pixelix.ws.Client.prototype.uninstall = function(options) {
    return new Promise(function(resolve, reject) {
        if (null === this.socket) {
            reject();
        } else if ("number" !== typeof options.slotId) {
            reject();
        } else {
            this._sendCmd({
                name: "UNINSTALL",
                par: options.slotId,
                resolve: resolve,
                reject: reject
            });
        }
    }.bind(this));
};
