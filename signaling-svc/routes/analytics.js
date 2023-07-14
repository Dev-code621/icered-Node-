const router = require('express').Router()
const User = require('../models/User.model')
const Report = require('../models/Reports.model')
const Log = require('../schemas/Log.schema')
const Post = require('../models/Post.model')
const Room = require('../models/Room.model')

const fn = {
    signups: async (query) => {
        const {
            date_from,
            date_to,
            format
        } = query

        let labels = []
        let data = [
            58, 94, 55, 11
        ]


        return {
            labels,
            data,
            label: 'Signups'
        }
    }
}

router.get('/', async (req, res) => {
    let function_name = req.params.function
    let reports = {}

    console.log('type' , typeof fn[function_name])
    if (typeof fn[function_name] == 'function') {
        const f = fn[function_name]
        reports = f(req.params.query)
    }

    res.json(reports)
})

module.exports = router