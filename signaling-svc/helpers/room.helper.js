const jwt = require('jsonwebtoken');

const Interest = require('../models/Interest.model');
const User = require('../models/User.model');
const Report = require('../models/Reports.model');
const Room = require('../models/Room.model')

module.exports.settingsToObject = async (settings) => {
    // convert a room's settings array from the db into a usable object
    let templateSettings = {
        private,
        chat,
        video,
        audio,
        disabled,
        public,
        invite_only,
        network_only
    } 

    settings.forEach(async settingStr => {
        let setting = settingStr.split(':')

        switch(setting[0]) {
            case 'private':
            case 'chat':
            case 'video':
            case 'audio':
            case 'disabled':
            case 'public':
            case 'invite_only':
            case 'network_only':
                templateSettings[setting[0]] = setting[1]
            break;
            default: 
                
        }
    })

    return templateSettings
}

module.exports.settingsToArray = settingsObj => {
    let returnSettings = []
    // for db insertion
    console.log('settings obj', settingsObj)
    Object.keys(settingsObj).forEach( key => {
        returnSettings.push(`${key}:${settingsObj[key]}`)
    })

    return returnSettings;
}

module.exports.getSettingsTemplate = (template, config = null) => {
  
        let templateSettings = {
            private: false,
            chat: true,
            video: true,
            audio: true,
            public: true,
            invite_only: false,
            network_only: false
        }

        let { description } = config

        switch(template) {
            case 'open':
                // Defaults are ok for open rooms
                description = (!description) ? 'This room is open to everybody.' : description

            break;
            case 'social':
                templateSettings.private = false
                templateSettings.network_only = true
                description = (!description) ? `This room is open to people in yours and your moderators' network.` : description
                break;
            case 'closed':
                templateSettings.private = true
                templateSettings.invite_only = true
                templateSettings.public = false
                description = (!description) ? 'An invitation only room.' : description
            break;
            default:
                return { success: false, error: "Settings template is required" }
        }

        config['description'] = description

        return { templateSettings, config, success: true }
    
}