const http = require('http')

module.exports.forward = async (params) => {
    return new Promise((resolve, reject) => {
        let {
            target,
            req,
            client_res
        } = params
        console.log('url', req.url)
        var options = {
          hostname: target,
          port: 80,
          path: req.url,
          method: req.method,
          headers: req.headers
        };
        
        let data = ''

        console.log('options dude', options)
        var httpReq = http.request(options, res => {
           // console.log('req', req)

            res.on('data', d => {
                console.log('d', d)
                data += d
                //req.pipe(d).pipe(client_res)
            })

            res.on('end', () => {
                resolve(data)
            })
        })
      
        httpReq.on('error', error => {
            console.error(error)
            reject(error)
        })

        httpReq.end()
        //resolve(proxy)
    })
}
