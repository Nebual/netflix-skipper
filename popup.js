'use strict';

$(function () {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        var showError = function (err) {
            $('.some-error').removeClass('hidden');
            $('.no-error').addClass('hidden');
            $('#error-msg').html(err);
        };
        $('#close-error').click(function () {
            $('.no-error').removeClass('hidden');
            $('.some-error').addClass('hidden');
        });

        // send a message to the content script
        var sendMessage = function (type, data, callback) {
            chrome.tabs.executeScript(tabs[0].id, {
                file: 'content_script.js'
            }, function () {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: type,
                    data: data
                }, function (response) {
                    if (response.errorMessage) {
                        showError(response.errorMessage);
                        return;
                    }
                    if (callback) {
                        callback(response);
                    }
                });
            });
        };

        chrome.storage.local.get({
            "enableSkipping": 1,
            "sexThreshold": 2,
            "bloodThreshold": 2,
            "violenceThreshold": 2,
            "suicideThreshold": 2,
            "needleThreshold": 0,
            "editorMode": false
        }, function (data) {
            $('#enable-skipping').prop('checked', data['enableSkipping']);
            $('#sex-threshold').val(data['sexThreshold']);
            $('#blood-threshold').val(data['bloodThreshold']);
            $('#violence-threshold').val(data['violenceThreshold']);
            $('#suicide-threshold').val(data['suicideThreshold']);
            $('#needle-threshold').val(data['needleThreshold']);
            $('#editor-settings').toggleClass('hidden', !data['editorMode']);
        });

        $('.ns-setting').change(function () {
            chrome.storage.local.set({
                'enableSkipping': $('#enable-skipping').is(':checked'),
                'sexThreshold': $('#sex-threshold').val(),
                'bloodThreshold': $('#blood-threshold').val(),
                'violenceThreshold': $('#violence-threshold').val(),
                'suicideThreshold': $('#suicide-threshold').val(),
                'needleThreshold': $('#needle-threshold').val()
            }, function () {
                sendMessage('reloadSettings', {});
            });
        });

        $('#skip-to').change(function () {
            sendMessage('skipTo', {time: $(this).val()});
        });
        $('#editor-mode-toggle').click(function () {
            chrome.storage.local.set({
                'editorMode': $('#editor-settings').hasClass('hidden')
            });
            $('#editor-settings').toggleClass('hidden');
        });
    });
});
