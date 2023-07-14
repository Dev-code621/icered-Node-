const router = require('express').Router()
const User = require('../../models/User.model')
const Report = require('../../models/Reports.model')
const Post = require('../../models/Post.model')

router.get('/list', async (req, res) => {
    let users = await User.find({})
    res.json(users)
})

router.get('/:id/data', async (req, res) => {
    console.log('id', req.params)
    let userdata = await User.findOne({ _id: req.params.id })
    if (!userdata) {
        res.status(400)
        res.json({ success: false, error: {
            message: "User not found."
        }})
        return
    }

    res.json(userdata)
    return
})

router.post('/:id/warn', async (req, res) => {
    const { reason, warner } = req.body
    const id = req.params.id

    let user = await User.findOne({ _id: id })

    if (!user) {
        res.json({ success: false, error: {
            message: 'Report not found.'
        }})
        return   
    }

    let warning = { reason, warned_by: warner }
    user.warnings = user.warnings.length > 0 ? user.warnings : []
    user.warnings.push(warning)
    let saved = user.save()

    if (saved) {
        res.json({ success: true })
    } else {
        res.json({ success: false, error: {
            message: "Could not save warning."
        }})
    }
})

router.get('/:id/posts', async (req, res) => {
    let posts = await Post.find({ author: req.params.id })
    
    res.json(posts)
    return
})
router.post('/:id/ban', async (req, res) => {
    let userdata = await User.findOne({ _id: req.params.id })
    if (!userdata) {
        res.status(400)
        res.json({ success: false, error: {
            message: "User not found."
        }})
        return
    }

    if (userdata['is_banned']) {
        res.status(400)
        res.json({ success: false, error: {
            message: "User is already banned."
        }})
        return
    }

    userdata['is_banned'] = true

    // sign out user and disable alerts
    userdata['webTokens'] = []
    userdata['refreshTokens'] = []
    userdata['devices'] = []

    let saved = await userdata.save()
    console.log('saved', saved)
    return res.json({ success: true })
})

router.post('/:id/unban', async (req, res) => {
    let userdata = await User.findOne({ _id: req.params.id })
    if (!userdata) {
        res.status(400)
        res.json({ success: false, error: {
            message: "User not found."
        }})
        return
    }

    if (!userdata['is_banned']) {
        res.json({ success: false, error: {
            message: "User is already not banned."
        }})
        return
    }

    userdata['is_banned'] = false

    let saved = await userdata.save()
    console.log('saved', saved)
    return res.json({ success: true })
})

router.post('/:id/delete', async (req, res) => {
    let status = await User.findOneAndDelete({ _id: req.params.id})
        .then(result => {
            return { success: true }
        })
        .catch((err) => {
            console.error(err)
            res.status(400)
            return { success: false, error: { message: err }}
        })
    res.json(status)
})

router.get('/:id/aliases', async (req, res) => {
    let userdata = await User.findOne({ _id: req.params.id })
    if (!userdata) {
        res.status(400)
        res.json({ success: false, error: {
            message: "User not found."
        }})
        return
    }

    let aliases = await User.find({ alias_owner: req.params.id })
    res.json(aliases)

    return
})

router.get('/:id/reports/filed', async (req, res) => {
    let user = await User.findOne({ _id: req.params.id })
    if (!user) {
        res.status(400)
        res.json({ success: false, error: {
            message: "User not found."
        }})
        return
    }

    let reports = await Report.find({ author: user.id })
    res.json(reports)
})

router.get('/:id/reports/against', async (req, res) => {
    let user = await User.findOne({ _id: req.params.id })
    if (!user) {
        res.status(400)
        res.json({ success: false, error: {
            message: "User not found."
        }})
        return
    }

    let reports = await Report.find({ content_author: user.id })
    res.json(reports)
})

module.exports = router