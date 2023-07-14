
const axios = require('axios')
 let uri = 'http://localhost:8342'
// const uri = 'https://media.icered.com'
let response;
let room_id = window.ROOM_ID;
console.log('room_id', room_id)
if (window.location.hostname !== 'localhost') {
  uri = 'https://media.icered.com'
}
module.exports = {
  request: (method, params) => {
    return new Promise(async (resolve, reject) => {
      switch (method) {
        case 'getRoom':
          response = await axios.get(`${uri}/room/${room_id}`).catch(err => reject(err))
        break;
        case 'produceData':
          response = await axios.post(`${uri}/room/${room_id}/produceData/create`, params).catch(err => reject(err))
        break;
        case 'produce':
          response = await axios.post(`${uri}/room/${room_id}/producer/create`, params).catch(err => reject(err))
        break;
        case 'transport-connect':
          response = await axios.post(`${uri}/room/${room_id}/transport/connect`, params).catch(err => reject(err))
        break;
        case 'createTransport':
          response = await axios.post(`${uri}/room/${room_id}/transport/create`, params).catch(err => reject(err))
        break;
        case 'producers':
          response = await axios.get(`${uri}/room/${room_id}/producers`).catch(err => reject(err))
        break;
        case 'consumer':
          response = await axios.post(`${uri}/room/${room_id}/consumer/create`, params).catch(err => reject(err))
        break;
        case 'consumerResume':
          response = await axios.post(`${uri}/room/${room_id}/consumer/${params.consumer_id}/resume`, params).catch(err => reject(err))
        break;
      }
      //console.log({ method, params, response })
      resolve(response.data);
    })
  }
}