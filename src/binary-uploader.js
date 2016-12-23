/**
 * Created by irelance on 2016/12/23.
 */
var BinaryUploader = {};
BinaryUploader.required = {
    $: {name: 'jQuery'},
    MessBootstrap: {name: 'MessBootstrap'},
    Base64: {name: 'Base64'}
};
BinaryUploader.instance = {};

(function ($, undefined) {
    if (typeof FileReader == "undefined") {
        return alert("您的浏览器不支持分段上传,请使用最新版的Chrome,FireFox,或Safari浏览器");
    }
    for (var i in BinaryUploader.required) {
        if (eval('typeof ' + i + '=="undefined"')) {
            return console.log('Module:[' + BinaryUploader.required[i].name + '] undefined!');
        }
    }

    var defaults = {
        prefix: 'bssf',
        dataKey: {
            link: "link",
            hash: "md5",
            chunkNumber: "chunk_number",
            chunkSize: "chunk_size",
            size: "size",
            name: "name"
        },
        status: {processing: "processing", complete: "complete", failed: "failed"},
        sliceUpload: {
            keys: {binary: "binary", currentChunk: "current_chunk", start: "start", end: "end"},
            method: "post", url: "",
            hidden: {}
        },
        sliceCheck: {
            method: "get", url: "",
            hidden: {}
        },
        fileMake: {
            method: "post", url: "",
            hidden: {}
        },
        hash: {
            defaults: "md5", chunkSize: 2097152,
            adapters: {
                md5: {className: "SparkMD5", method: {reset: "reset", append: "appendBinary", final: "end"}},
                sha1: {className: "Rusha", method: {reset: "resetState", append: "append", final: "end"}}
            }
        },
        worker: 4
    };

    var HashAdapter = function (options) {
        this.object = new (eval(options.className))();
        this.reset = function () {
            return this.object[options.method.reset]();
        };
        this.append = function (str) {
            return this.object[options.method.append](str);
        };
        this.final = function () {
            return this.object[options.method.final]();
        };
    };

    var Template = function (options) {
        this.status = {
            waiting: "upload-waiting",
            processing: "upload-processing",
            complete: "upload-complete",
            fail: "upload-fail"
        };
        this.template = new function () {
            this.message = function (level, type, msg) {
                return '<div class="alert alert-' + level + ' ' + options.prefix + 'message-' + type + '">' + msg + '</div>';
            };
            this.button = function (label, type, name) {
                return '<button type="button" class="btn btn-' + type + ' ' + options.prefix + name + '">' + label + '</button>';
            };
        };
        this.init = function (element, file) {
            var buttonBox = $('<div class="col-sm-6 ' + options.prefix + 'button-box"></div>');
            var children = element.children();
            var extraButtonBox = $('<div class="' + options.prefix + 'extra-button-box pull-right"></div>');
            children.each(function () {
                extraButtonBox.append(this);
            });
            var uploadButtonBox = $('<div class="' + options.prefix + 'upload-button-box pull-right"></div>');
            buttonBox.append(extraButtonBox).append(uploadButtonBox);
            var firstBox = $('<div class="col-sm-6 ' + options.prefix + 'first-box"></div>');
            var fileBox = $('<div class="col-sm-6 ' + options.prefix + 'file-box"></div>');
            firstBox.append(fileBox.html(file));
            element.append(firstBox).append(buttonBox);
        };
        this.sendMsg = function (element, level, type, msg) {
            element.find('.' + options.prefix + 'first-box').children().hide();
            element.find('.' + options.prefix + 'first-box .' + options.prefix + 'msg-' + type).remove();
            element.find('.' + options.prefix + 'first-box').append(this.template.message(level, type, msg));
            if (level == 'danger') {
                setTimeout(function () {
                    element.find('.' + options.prefix + 'first-box').children().hide();
                    element.find('.' + options.prefix + 'file-box').show();
                }, 1000);
            }
        };
        this.getMsgs = function (element, type) {
            if (type == undefined) {
                return element.find('.' + options.prefix + 'first-box div');
            }
            return element.find('.' + options.prefix + 'first-box .' + options.prefix + 'message-' + type);
        };
        this.upload = function (element, chunkNumber, existChunk) {
            var i = 0;
            var html = '<div class="' + options.prefix + 'upload-box">';
            var width = 1 / chunkNumber * 100;
            if (existChunk) {
                var temp = '';
                var j = 0;
                for (i = 0; i < chunkNumber; i++) {
                    if (existChunk[i]) {
                        temp += '<span style="width: ' + width + '%;" class="' + this.status.complete + '" data-current="' + i + '"></span>';
                        j++;
                    } else {
                        temp += '<span style="width: ' + width + '%;" class="' + this.status.waiting + '" data-current="' + i + '"></span>';
                    }
                }
                html += '<p class="progress-box">' + Math.ceil(100 * j / chunkNumber) + '%</p>';
                html += temp;
            } else {
                html += '<p class="progress-box">0%</p>';
                for (i = 0; i < chunkNumber; i++) {
                    html += '<span style="width: ' + width + '%;" class="' + this.status.waiting + '" data-current="' + i + '"></span>';
                }
            }
            html += '</div>';
            element.find('.' + options.prefix + 'first-box').append(html);
            element.find('.' + options.prefix + 'first-box').children().hide();
            element.find('.' + options.prefix + 'file-box').show();
        };
        this.getChunks = function (element, status) {
            if (status == undefined) {
                return element.find('.' + options.prefix + 'upload-box span');
            }
            return element.find('.' + options.prefix + 'upload-box .' + this.status[status]);
        };
        this.setChunkStatus = function (chunk, status) {
            chunk.attr('class', this.status[status]);
            chunk.parents('.' + options.prefix + 'first-box').children().hide();
            chunk.parents('.' + options.prefix + 'upload-box').show();
        };
        this.percent = function (element, percent) {
            element.find('.' + options.prefix + 'upload-box .progress-box').html(percent + '%');
        };
        this.setButton = function (element, label, type, name, callBack) {
            var button = $(this.template.button(label, type, name));
            button.on('click', callBack);
            element.find('.' + options.prefix + 'upload-button-box').html(button);
        };
        this.endButton = function (element) {
            element.find('.' + options.prefix + 'upload-button-box').html('');
        };
        this.setFile = function (element, file) {
            element.find('.' + options.prefix + 'file-box').html(file);
        }
    };

    function opts_from_el(el, prefix) {
        // Derive options from element data-attrs
        var data = $(el).data(),
            out = {}, inkey,
            replace = new RegExp('^' + prefix.toLowerCase() + '([A-Z])');
        prefix = new RegExp('^' + prefix.toLowerCase());
        function re_lower(_, a) {
            return a.toLowerCase();
        }

        for (var key in data)
            if (prefix.test(key)) {
                inkey = key.replace(replace, re_lower);
                out[inkey] = data[key];
            }
        return out;
    }

    var template = null;

    BinaryUploader.Instance = function (element, options) {
        this.data = undefined;
        this.worker = options.worker;
        this.makeFlag = 0;
        this.processStatus = true;
        this.id = options.id;
        this.file = $('<input type="file">')[0];
        this.hashAdapter = new HashAdapter(options.hash.adapters[options.hash.defaults]);
        this.hashString = '';
        this.sliceCheck = function () {
            var data = {id: this.id};
            for (var i in options.sliceCheck.hidden) {
                data[i] = options.sliceCheck.hidden[i];
            }
            $.ajax({
                url: options.sliceCheck.url,
                type: options.sliceCheck.method,
                data: data,
                success: function (res) {
                    if (res.status) {
                        this.data = res.file;
                        if (res.file.status == options.status.complete) {
                            template.sendMsg(element, 'success', 'upload', '文件已上传');
                            template.endButton(element);
                        } else {
                            if (res.file.chunk_number == res.chunk.total) {
                                template.sendMsg(element, 'warning', 'upload', '可进行合并文件');
                                template.setButton(element, '合并文件', 'primary', 'merge', function () {
                                    this.makeFile();
                                }.bind(this));
                            } else {
                                template.upload(element, res.file.chunk_number, res.chunk.exist);
                                this.onFileChange();
                                template.setButton(element, '续传', 'primary', 'upload', function () {
                                    this.upFileSlices();
                                }.bind(this));
                            }
                        }
                    } else {
                        element.parents('tr').hide();
                    }
                }.bind(this)
            });
        };
        this.init = function () {
            template.init(element, this.file);
            this.sliceCheck();
        };
        this.receiveFile = function (file, hash) {
            if (!file.files) {
                return false;
            }
            if (this.data[options.dataKey.hash] != hash) {
                return false;
            }
            this.file = file;
            this.hashString = hash;
            template.setFile(element, this.file);
            template.sendMsg(element, 'success', 'hash', '验证成功');
            this.onFileChange();
        };
        this.onFileChange = function () {
            var fileReader = new FileReader();
            var fileUpper = this;
            fileUpper.hashAdapter.reset();
            $(this.file).on('change', function () {
                template.sendMsg(element, 'warning', 'hash', '待验证');
                var file = this.files[0];
                if (file == undefined) {
                    template.sendMsg(element, 'danger', 'upload', '请选择文件');
                }
                var chunkSize = options.hash.chunkSize;
                var chunks = Math.ceil(file.size / chunkSize);
                var currentChunk = 0;
                fileReader.onload = function (e) {
                    fileUpper.hashAdapter.append(e.target.result);
                    currentChunk++;
                    if (currentChunk < chunks) {
                        loadNext();
                    } else {
                        fileUpper.hashString = fileUpper.hashAdapter.final();
                        if (fileUpper.data[options.dataKey.hash] != fileUpper.hashString) {
                            return template.sendMsg(element, 'danger', 'hash', '文件不一致');
                        }
                        return template.sendMsg(element, 'success', 'hash', '已完成文件验证');
                    }
                };
                function loadNext() {
                    if (fileUpper.processStatus) {
                        template.sendMsg(element, 'warning', 'hash', '验证进度: ' + Math.ceil(100 * currentChunk / chunks) + '%');
                        var start = currentChunk * chunkSize, end = start + chunkSize >= file.size ? file.size : start + chunkSize;
                        fileReader.readAsBinaryString(file.slice(start, end));
                    } else {
                        template.sendMsg(element, 'danger', 'upload', '请重新上传文件');
                    }
                }

                loadNext();
            });
        };
        this.upFileSlices = function () {
            var fileUpper = this;
            if (!$(fileUpper.file).val()) {
                return template.sendMsg(element, 'danger', 'upload', '请选择文件');
            }
            if (template.getMsgs(element, 'hash').hasClass('alert-success')) {
                for (var w = 0; w < this.worker; w++) {
                    this.upFileSlice();
                }
                template.setButton(element, '暂停', 'default', 'pause', function () {
                    fileUpper.processStatus = false;
                    template.setButton(element, '继续', 'default', 'continue', function () {
                        fileUpper.processStatus = true;
                        fileUpper.upFileSlices();
                    });
                });
            } else {
                template.sendMsg(element, 'danger', 'upload', '文件未完成验证');
            }
        };
        this.upFileSlice = function () {
            var fileUpper = this;
            var waiting = template.getChunks(element, 'waiting');
            if (waiting.length && fileUpper.processStatus) {
                var fileReader = new FileReader();
                var file = this.file.files[0];
                var current = $(waiting[0]);
                var currentChunk = current.data('current');
                var chunkSize = this.data[options.dataKey.chunkSize];
                var start = currentChunk * chunkSize;
                var end = start + chunkSize >= file.size ? file.size : start + chunkSize;
                template.setChunkStatus(current, 'processing');
                fileReader.readAsBinaryString(file.slice(start, end));
                fileReader.onload = function (e) {
                    var sliceUploadData = {'id': fileUpper.id};
                    sliceUploadData[options.sliceUpload.keys.binary] = Base64.encode(fileReader.result);
                    sliceUploadData[options.sliceUpload.keys.currentChunk] = currentChunk;
                    sliceUploadData[options.sliceUpload.keys.start] = start;
                    sliceUploadData[options.sliceUpload.keys.end] = end;
                    for (var i in options.sliceUpload.hidden) {
                        sliceUploadData[i] = options.sliceUpload.hidden[i];
                    }
                    $.ajax({
                        type: options.sliceUpload.method,
                        url: options.sliceUpload.url,
                        data: sliceUploadData,
                        success: function (res) {
                            if (res.status) {
                                template.setChunkStatus(current, 'complete');
                                var completeNumber = template.getChunks(element, 'complete').length;
                                var chunkNumber = template.getChunks(element).length;
                                template.percent(element, Math.ceil(100 * completeNumber / chunkNumber));
                                fileUpper.upFileSlice();
                            } else {
                                template.setChunkStatus(current, 'fail');
                            }
                        },
                        error: function (res) {
                            template.setChunkStatus(current, 'fail');
                        }
                    });
                };
            } else {
                fileUpper.makeFlag++;
                if (fileUpper.makeFlag >= fileUpper.worker && template.getChunks(element, 'complete').length == fileUpper.data[options.dataKey.chunkNumber]) {
                    fileUpper.makeFile();
                }
            }
        };
        this.makeFile = function () {
            template.sendMsg(element, 'warning', 'upload', '正在合并');
            var fileMakeData = {
                'id': this.id
            };
            for (var i in options.fileMake.hidden) {
                fileMakeData[i] = options.fileMake.hidden[i];
            }
            $.ajax({
                type: options.fileMake.method,
                url: options.fileMake.url,
                data: fileMakeData,
                success: function (res) {
                    template.sendMsg(element, res.status ? 'success' : 'danger', 'upload', res.msg);
                    template.endButton(element);
                }
            });
        };
        this.init();
    };

    $.fn.binaryUploader = function (option) {
        var options = typeof option === 'object' && option;
        options = $.extend(true, defaults, options);
        template = new Template({prefix: options.prefix + '-'});
        this.each(function () {
            var $this = $(this);
            var elopts = opts_from_el(this, options.prefix);
            var opts = $.extend(true, options, elopts);
            if (opts.id > 0 && BinaryUploader.instance[opts.id] == undefined) {
                BinaryUploader.instance[opts.id] = new BinaryUploader.Instance($this, opts);
            }
        });
    };
})(window.jQuery);
