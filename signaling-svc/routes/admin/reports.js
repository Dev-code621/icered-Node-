const router = require('express').Router()
const User = require('../../models/User.model')
const Report = require('../../models/Reports.model')
const Log = require('../../schemas/Log.schema')
const Post = require('../../models/Post.model')
const Room = require('../../models/Room.model')

router.get('/list', async (req, res) => {
    let searchby = {}

    if (req.query.type) {
        switch(req.query.type) {
            case 'forum':
                searchby['content_type'] = 'post'
            break;
            case 'room':
                searchby['content_type'] = 'room'
            break;
            case 'user':
                searchby['content_type'] = 'user'
            break;
            case 'comment':
                searchby['content_type'] = 'comment'
            break;
            case 'message':
                searchby['content_type'] = 'message'
            break;
        }
    }
    let reports = await Report.find(searchby)
    res.json(reports)
})

router.get('/:id/data', async (req, res) => {
    let report = await Report.findOne({ _id: req.params.id })
    if (!report) {
        res.json({ success: false, error: {
            message: 'Report not found.'
        }})
        return
    }

    let content = null;
    // Lets get the report content
    switch(report.content_type) {
        case 'post':
            content = await Post.findOne({ _id: report.content_data })
        break;
        case 'room':
            content = await Room.findOne({ _id: report.content_data })
        break;
        case 'user':
            // I'm really not sure what to put here
        break;
    }
    console.log('show content', content)
    console.log('show report', report)
    report['content'] = content
    res.json(report)
})

router.get('/:id/content', async (req, res) => {
    let report = await Report.findOne({ _id: req.params.id })
    if (!report) {
        res.json({ success: false, error: {
            message: 'Report not found.'
        }})
        return
    }

    let content = null;
    // Lets get the report content
    switch(report.content_type) {
        case 'post':
            content = await Post.findOne({ _id: report.content_data })
        break;
        case 'room':
            content = await Room.findOne({ _id: report.content_data })
        break;
        case 'user':
            // I'm really not sure what to put here
        break;
    }
    console.log('show content', content)
    res.json(content)
})




router.post('/:id/resolve', async (req, res) => {
    let report = await Report.findOne({ _id: req.params.id })
    if (!report) {
        res.json({ success: false, error: {
            message: 'Report not found.'
        }})
        return
    }

    let message = req.body.message

    let newLog = {
        type: 'admin',
        message
    }

    report.logs = (report.logs.length > 0) ? report.logs : []

    report.logs.push(newLog)

    report.resolved = true

    let saved = await report.save()
        .catch(err => {
            console.error(err)
        })

    if (saved) {
        res.json({ success: true })
        return
    } else {
        res.json({ success: false, error: {
            message: 'Could not resolve report.'
        }})
    }
})

router.post('/:id/reopen', async (req, res) => {
    let report = await Report.findOne({ _id: req.params.id })
    if (!report) {
        res.json({ success: false, error: {
            message: 'Report not found.'
        }})
        return
    }

    let message = req.body.message

    let newLog = {
        type: 'admin',
        message
    }

    report.logs = (report.logs.length > 0) ? report.logs : []

    report.logs.push(newLog)

    report.resolved = false

    let saved = await report.save()
        .catch(err => {
            console.error(err)
        })

    if (saved) {
        res.json({ success: true })
        return
    } else {
        res.json({ success: false, error: {
            message: 'Could not reopen report.'
        }})
    }
})

module.exports = router