const CryptoJS = require("crypto-js")
const JSEncrypt = require('node-jsencrypt')
const fs = require('fs')
const cfg = require('./secs.cfg')
var Utils = {
    LocalStorage: {
        keyAES64: ''
    },
    File: {
        saveTextFile: function (fileName, content) {
            return new Promise((resolve, reject) => {
                fs.writeFile(fileName, content, function (err) {
                    if (err) reject(err)
                    var statusText = 'write file > ' + fileName + ' success'
                    resolve(statusText)
                })
            })
        },
        readTextFile: function (fileName) {
            return new Promise((resolve, reject) => {
                fs.readFile(fileName, 'utf8', function (err, data) {
                    if (err) return reject(error)
                    resolve(data)
                })
            })
        }
    },
    Http: {
        URL: {
            QueryString: function (name) {
                return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || ["", ""])[1].replace(/\+/g, '%20')) || null;
            }
        },

        Cookie: {
            Get: function (name) {
                var cname = name + "=";
                var ca = document.cookie.split(';');
                for (var i = 0; i < ca.length; i++) {
                    var c = ca[i];
                    while (c.charAt(0) == ' ') c = c.substring(1);
                    if (c.indexOf(cname) == 0) return c.substring(cname.length, c.length);
                }
                return null;
            },
            Set: function (name, value, days) {
                var d = new Date();
                d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
                var expires = "expires=" + d.toUTCString();
                var path = "path=/";
                document.cookie = name + "=" + value + ";" + path + "; " + expires;
            }
        },

        Message: function (pemKey) {
            var destroyed = false;
            var mode = "";
            var pemKey = pemKey;
            var aesKey64 = null;
            // TODO: need another condition for non-encrypt
            if (pemKey) {
                mode = "rsa*aes";
                var key = CryptoJS.lib.WordArray.random(16);
                aesKey64 = CryptoJS.enc.Base64.stringify(key);
                Utils.LocalStorage.keyAES64 = aesKey64
                console.log('Utils.LocalStorage.keyAES64:%s', aesKey64)
                Utils.File.saveTextFile(cfg.fileAESKey, aesKey64)
                //localStorage.setItem("aes-key", aesKey64);
            } else {
                mode = "aes";
                aesKey64 = Utils.LocalStorage.keyAES64
                console.log('aesKey64:%s', aesKey64)
                Utils.File.readTextFile(cfg.fileAESKey).then((key) =>  {
                    aesKey64 = key
                    log(aesKey64)
                })
                //aesKey64 = localStorage.getItem("aes-key");
            }

            function encrypt(plainText) {
                if (!aesKey64) return false;
                var key_bytes = CryptoJS.enc.Base64.parse(aesKey64);
                var iv_bytes = CryptoJS.lib.WordArray.random(16);
                var cipherText = Utils.Crypto.AES.Encrypt(
                    key_bytes,
                    iv_bytes,
                    16,
                    plainText
                );
                var iv64 = CryptoJS.enc.Base64.stringify(iv_bytes);
                return { iv: iv64, data: cipherText };
            }

            function decrypt(iv64, cipherText) {
                //console.log('cipherText:%s | iv64:%s', cipherText, iv64)
                iv64 = decodeURIComponent(iv64);
                cipherText = decodeURIComponent(cipherText);
                //console.log('cipherText:%s | iv64:%s', cipherText, iv64)
                if (!aesKey64) return false;
                var key_bytes = CryptoJS.enc.Base64.parse(aesKey64);
                var iv_bytes = CryptoJS.enc.Base64.parse(iv64);
                //console.log('key_bytes:%s | iv_bytes:%s', key_bytes, iv_bytes)
                var plainText = Utils.Crypto.AES.Decrypt(
                    key_bytes,
                    iv_bytes,
                    16,
                    cipherText
                );
                //console.log('plainText:%s', plainText)
                return plainText;
            }

            return {
                Destory: function () {
                    mode = null;
                    pemKey = null;
                    aesKey64 = null;
                    localStorage.removeItem("aes-key");
                    destroyed = true;
                },

                Encrypt: function (data) {
                    if (destroyed) return false;
                    if (mode == "rsa*aes") {
                        var cipherKey = Utils.Crypto.RSA.Encrypt(pemKey, aesKey64);
                        var cipher = encrypt(data);
                        if (!cipher) return false;
                        var data = {
                            key: encodeURIComponent(cipherKey),
                            iv: encodeURIComponent(cipher.iv),
                            data: encodeURIComponent(cipher.data)
                        };
                        return data;
                    } else {
                        return encrypt(data);
                    }
                },

                Decrypt: function (data, iv64) {
                    if (destroyed) return false;
                    return decrypt(iv64, data);
                },

                Send: function (jqAjaxOptions) {
                    this.New(jqAjaxOptions);
                },
                encryptParams: function (params) {
                    return this.Encrypt(JSON.stringify(params));
                },
                New: function (jqAjaxOptions) {
                    if (destroyed) return false;
                    _self = this;
                    jqAjaxOptions.data = this.Encrypt(JSON.stringify(jqAjaxOptions.data));

                    //success wrapper
                    var fn_success = jqAjaxOptions.success;
                    jqAjaxOptions.success = function (rsp) {
                        try {
                            var result = JSON.parse(rsp.Result);
                            var plainText = _self.Decrypt(result.Data, result.IV);
                            try {
                                rsp.Result = JSON.parse(plainText);
                            } catch (e) {
                                rsp.Result = plainText;
                            }
                        } catch (e) {
                            //console.log(e);
                        }
                        fn_success(rsp);
                    }

                    //error wrapper
                    var fn_error = jqAjaxOptions.error;
                    jqAjaxOptions.error = function (xhr, status, error) {
                        var errorMsg = status;
                        try {
                            errorMsg = xhr.responseJSON.ErrText;
                        } catch (e) {
                            if (error.length > 0) errorMsg = error;
                        }
                        fn_error(xhr, status, errorMsg);
                    }
                    return $.ajaxQueue(jqAjaxOptions);
                }
            }
        }
    },

    Crypto: {
        AES: {
            Encrypt: function (key, iv, keySize, plainText) {
                var encrypted = CryptoJS.AES.encrypt(plainText, key, {
                    keySize: keySize,
                    iv: iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                });
                return encrypted.toString();
            },
            Decrypt: function (key, iv, keySize, cipherText) {
                //console.log('key:%s | iv:%s | keySize:%s | cipherText:%s', key, iv, keySize, cipherText)
                var decrypted = CryptoJS.AES.decrypt(cipherText, key, {
                    keySize: keySize,
                    iv: iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                });
                var plainText = decrypted.toString(CryptoJS.enc.Utf8);
                //console.log(decrypted)
                return plainText;
            }
        },
        RSA: {
            Encrypt: function (pemKey, data) {
                var encrypt = new JSEncrypt();
                encrypt.setPublicKey(pemKey);
                var cipherKey = encrypt.encrypt(data);
                return cipherKey;
            }
        }
    },

    Random: {
        Hex: function (len) {
            key = "";
            var hex = "0123456789abcdefABCDEF";
            var size = hex.length;
            for (i = 0; i < len; i++) {
                key += hex.charAt(Math.floor(Math.random() * size));
            }
            return key;
        },
    },

    String: {
        IsNullOrWhitespace(value) {
            if (value == null) return true;
            if (typeof (value) == 'undefined') return true;
            if (typeof (value) == 'string' && value.trim().length == 0) return true;
            return false;
        },
        IsNullOrUndefined(value) {
            if (typeof (value) == "undefined") return true;
            if (typeof (value) == null) return true;
            return false;
        },
        ValidSubnet(value) {
            re = /^(([12]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])(\.|\/)){4}([1-2]?[0-9]|3[0-2])$/;
            return re.test(value);
        },
        IsIPv4(value) {
            re = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            return re.test(value);
        },
        CheckName(value) {
            var usernameRegex = /^[a-zA-Z0-9.@-]+$/;
            var validUsername = value.match(usernameRegex);
            return validUsername != null
        },
    },

    Datetime: {
        After(a, b) {
            var date_a = this.ToDate(this.RemoveTZ(a));
            var date_b = this.ToDate(this.RemoveTZ(b));
            return (date_a - date_b) > 0;
        },
        Before(a, b) {
            var date_a = this.ToDate(this.RemoveTZ(a));
            var date_b = this.ToDate(this.RemoveTZ(b));
            return (date_a - date_b) < 0;
        },
        Difference(a, b) {
            var date_a = this.ToDate(this.RemoveTZ(a));
            var date_b = this.ToDate(this.RemoveTZ(b));
            return (date_b - date_a) / 1000;
        },
        DifferenceFromNow(a) {
            var since = this.ToDate(this.RemoveTZ(a));
            var now = Date.now();
            return (now - since) / 1000;
        },
        RemoveTZ(dt) {
            dt = dt.replace('T', ' ');
            dt = dt.replace('Z', ' ');
            return dt;
        },
        SinceString(then) {
            var now = Date.now();
            var then = this.ToDate(this.RemoveTZ(then));
            return Math.abs(now - then) / 36e5;
        },
        ToDate(dt) {
            var regex = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/;
            var dateArray = regex.exec(dt);
            var dateObject = new Date(
                (+dateArray[1]),
                (+dateArray[2]) - 1, // month starts at 0
                (+dateArray[3]),
                (+dateArray[4]),
                (+dateArray[5]),
                (+dateArray[6])
            );
            return dateObject;
        },
        LastActive(since) {
            var diff_unit = this.DiffSince(since);
            if (diff_unit[0] > 0) {
                return this.RemoveTZ(since);
            }
            if (diff_unit[1] > 0) {
                return diff_unit[1] + " hr " + diff_unit[2] + " min ago";
            } else if (diff_unit[2] > 0) {
                return diff_unit[2] + " min " + diff_unit[3] + " sec ago";
            } else {
                return diff_unit[3] + " sec ago";
            }
        },
        LastActiveB(since, then) {
            var diff_unit = this.DiffSinceB(since, then);
            if (diff_unit[0] > 0) {
                return this.RemoveTZ(since);
            }
            if (diff_unit[1] > 0) {
                return diff_unit[1] + " hr " + diff_unit[2] + " min ago";
            } else if (diff_unit[2] > 0) {
                return diff_unit[2] + " min " + diff_unit[3] + " sec ago";
            } else {
                return diff_unit[3] + " sec ago";
            }
        },
        DiffSince(since, unit_amounts) {
            var split_to_whole_units = function (milliseconds, unit_amounts) {
                // unit_amounts = list/array of amounts of milliseconds in a
                // second, seconds in a minute, etc., for example "[1000, 60]".
                time_data = [milliseconds];
                for (i = 0; i < unit_amounts.length; i++) {
                    time_data.push(parseInt(time_data[i] / unit_amounts[i]));
                    time_data[i] = time_data[i] % unit_amounts[i];
                }; return time_data.reverse();
            }; if (unit_amounts == undefined) {
                unit_amounts = [1000, 60, 60, 24];
            };
            var date_a = Date.now()
            var date_b = this.ToDate(this.RemoveTZ(since));
            var diff = (date_a - date_b);
            return split_to_whole_units(diff, unit_amounts);
        },
        DiffSinceB(since, then, unit_amounts) {
            var split_to_whole_units = function (milliseconds, unit_amounts) {
                // unit_amounts = list/array of amounts of milliseconds in a
                // second, seconds in a minute, etc., for example "[1000, 60]".
                time_data = [milliseconds];
                for (i = 0; i < unit_amounts.length; i++) {
                    time_data.push(parseInt(time_data[i] / unit_amounts[i]));
                    time_data[i] = time_data[i] % unit_amounts[i];
                }; return time_data.reverse();
            }; if (unit_amounts == undefined) {
                unit_amounts = [1000, 60, 60, 24];
            };
            var date_a = this.ToDate(this.RemoveTZ(then));
            var date_b = this.ToDate(this.RemoveTZ(since));
            var diff = (date_a - date_b);
            return split_to_whole_units(diff, unit_amounts);
        },
        Date(dt) {
            return dt.split("T")[0];
        },
        Time(dt) {
            var t = dt.split("T")[1].replace('Z', '');
            var tset = t.split(":");
            if (tset[0].length == 1) {
                tset[0] = "0" + tset[0];
            }
            if (tset[1].length == 1) {
                tset[1] = "0" + tset[1];
            }
            return tset[0] + ":" + tset[1];
        },
        GetString(subtract_day = 0, subtract_sec = 0, midnight = false, second = false) {
            var date = new Date(new Date().getTime() + 24 * 60 * 60 * 1000 * subtract_day + subtract_sec * 1000);
            if (!second) {
                var time = "00:00";
                if (!midnight) {
                    time = ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2);
                }
                return date.getFullYear() + "/" + ("0" + (date.getMonth() + 1)).slice(-2) + '/' + ('0' + date.getDate()).slice(-2) + ' ' + time;
            } else {
                var time = "00:00:00"
                if (!midnight) {
                    time = ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2) + ":" + ('0' + date.getSeconds()).slice(-2);
                }
                return date.getFullYear() + "/" + ("0" + (date.getMonth() + 1)).slice(-2) + '/' + ('0' + date.getDate()).slice(-2) + ' ' + time;
            }
        },
        Get(subtract_day = 0, subtract_sec = 0, midnight = true) {
            var d = new Date(new Date().getTime() + 24 * 60 * 60 * 1000 * subtract_day + subtract_sec * 1000);
            if (midnight) {
                d.setHours(0, 0, 0, 0);
            }
            return d;
        }
    },

    UI: {
        KeepCenter(container_id) {
            if (Utils.Browser.IsMobile())
                return;
            Utils.UI.Center(container_id);
            $(window).resize(function () {
                Utils.UI.Center(container_id);
            });
        },

        Center(container_id) {
            $container = $(container_id);
            var body = document.body;
            var body_height = Math.max(body.scrollHeight, body.offsetHeight);
            var container_height = $container.innerHeight();
            var container_width = $container.innerWidth();
            if (body_height > container_height + 5) {
                $container.css({ 'height': container_height, 'position': 'absolute', 'top': '50%', 'margin-top': '-' + container_height / 2, 'left': '50%', 'margin-left': "-" + container_width / 2 });
            } else {
                $container.css({ 'height': 'auto', 'position': 'relative', 'top': 'initial', 'left': 'initial', 'margin': '0 auto' });
            }
        },

        SelectText(element) {
            var doc = document
                , text = element
                , range, selection
                ;
            if (doc.body.createTextRange) {
                range = document.body.createTextRange();
                range.moveToElementText(text);
                range.select();
            } else if (window.getSelection) {
                selection = window.getSelection();
                range = document.createRange();
                range.selectNodeContents(text);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        },

        CopyToClipboard(value) {
            try {
                var success = document.execCommand('copy');
                return success;
            } catch (err) {
                return false;
            }
        },

        Paging(container, currentPage, total, pageSize, onChange) {
            var pages = [];
            var total_page = Math.ceil(total / pageSize);
            if (total_page <= 20) {
                for (var i = 1; i < total_page + 1; i++) {
                    if (i == currentPage) pages.push('<button class="page__item" status="active">' + i + '</button>');
                    else pages.push('<button class="page__item">' + i + '</button>');
                }
            } else {
                var page_section_start = [];
                var page_section_middle = [];
                var page_section_end = [];
                if (currentPage <= 5) {
                    for (var i = 1; i <= total_page; i++) {
                        if (i <= (currentPage + 2)) {
                            if (i == currentPage) page_section_start.push('<button class="page__item" status="active">' + i + '</button>');
                            else page_section_start.push('<button class="page__item">' + i + '</button>');
                        }
                        else if (i >= total_page - 2) page_section_end.push('<button class="page__item">' + i + '</button>');
                    }
                    page_section_middle.push('<span class="page__hidden">...</span>');
                }
                else if (currentPage >= (total_page - 5)) {
                    for (var i = 1; i <= total_page; i++) {
                        if (i <= 3) page_section_start.push('<button class="page__item">' + i + '</button>');
                        else if (i >= (currentPage - 2)) {
                            if (i == currentPage) page_section_end.push('<button class="page__item" status="active">' + i + '</button>');
                            else page_section_end.push('<button class="page__item">' + i + '</button>');
                        }
                    }
                    page_section_middle.push('<span class="page__hidden">...</span>');
                } else {
                    if (currentPage > 6) page_section_middle.push('<span class="page__hidden">...</span>');
                    for (var i = 1; i <= total_page; i++) {
                        if (i <= 3) page_section_start.push('<button class="page__item">' + i + '</button>');
                        else if (i >= (total_page - 2)) page_section_end.push('<button class="page__item">' + i + '</button>');
                        else if (i >= (currentPage - 2) && i <= (currentPage + 2)) {
                            if (i == currentPage) page_section_middle.push('<button class="page__item" status="active">' + i + '</button>');
                            else page_section_middle.push('<button class="page__item">' + i + '</button>');
                        }
                    }
                    page_section_middle.push('<span class="page__hidden">...</span>');
                }
                pages = page_section_start.concat(page_section_middle).concat(page_section_end);
            }

            container.html(pages.join('')).show();

            var $page_item = container.find('.page__item');
            $page_item.click(function () {
                var page = parseInt($(this).html());
                $page_item.removeAttr('status');
                $(this).attr('status', 'active');
                onChange(page);
            });
        }
    },

    Browser: {
        IsMobile() {
            try {
                return (/Mobi/i).test(navigator.userAgent);
            } catch (err) {
                return false;
            }
        }
    },

    Colors: {
        LightGreen: "#64ff00",
        DeepGreen: "#338a00",
        Orange: "#f18700",
        Grey: "#868686",
        Red: "#ed1c24",
        LightBlue: "#0000FF",
        DeepBlue: "#000095",
        palette: ["#F15854", "#DECF3F", "#B276B2", "#B2912F", "#F17CB0", "#60BD68", "#FAA43A", "#5DA5DA", "#4D4D4D", "#3e95cd", "#8e5ea2", "#3cba9f", "#e8c3b9"],
        Pick(len) {
            var new_palette = this.palette;
            while (len > new_palette.length) {
                new_palette.push.apply(new_palette, this.palette);
            }
            return new_palette.slice(0, len);
        },
    },

    Array: {
        Shuffle(array) {
            var currentIndex = array.length, temporaryValue, randomIndex;

            // While there remain elements to shuffle...
            while (0 !== currentIndex) {

                // Pick a remaining element...
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex -= 1;

                // And swap it with the current element.
                temporaryValue = array[currentIndex];
                array[currentIndex] = array[randomIndex];
                array[randomIndex] = temporaryValue;
            }

            return array;
        }
    },
};
module.exports = Utils