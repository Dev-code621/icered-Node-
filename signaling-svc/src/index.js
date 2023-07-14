import { Device } from 'mediasoup-client';
import signal from './signaling.client'; // Our own signaling stuff.
import { v4 as uuidv4 } from 'uuid';

window.join = async () => {
  const jwt = document.getElementById('jwt').value;
  console.log('jwt', jwt)
  window.producers = {};


  // Create a device (use browser auto-detection).
  const device = new Device();

  // Communicate with our server app to retrieve router RTP capabilities.
  const {
    routerRtpCapabilities,
    room
   } = await signal.request('getRoom');
  console.log('routerCapabilities', routerRtpCapabilities, room)
  // Load the device with the router RTP capabilities.
  await device.load({ routerRtpCapabilities });

  // Create a transport in the server for sending our media through it.
  const sendTransportData = await signal.request(
    'createTransport',
    {
      sctpCapabilities : device.sctpCapabilities,
      appData: {
        jwt
      }
    });
  const recvTransportData = await signal.request(
    'createTransport',
    {
      sctpCapabilities: device.sctpCapabilities,
      appData: {
        jwt
      }
    }
  )

  console.log('send transport', sendTransportData)
  console.log('recv transport', recvTransportData)

  const sendTransportParams = {
    id: sendTransportData.id, 
    iceParameters: sendTransportData.iceParameters, 
    iceCandidates: sendTransportData.iceCandidates, 
    dtlsParameters: sendTransportData.dtlsParameters,
    sctpParameters: sendTransportData.sctpParameters,
    appData: sendTransportData.appData
  };
  const recvTransportParams = {
    id: recvTransportData.id, 
    iceParameters: recvTransportData.iceParameters, 
    iceCandidates: recvTransportData.iceCandidates, 
    dtlsParameters: recvTransportData.dtlsParameters,
    sctpParameters: recvTransportData.sctpParameters,
    appData: recvTransportData.appData
  };

  // Create the local representation of our server-side transport.
  const sendTransport = device.createSendTransport(sendTransportParams);
  const recvTransport = device.createRecvTransport(recvTransportParams);

  // Set transport "connect" event handler.
  const connectSendHandler = async ({ dtlsParameters }, callback, errback) => {
    let transport = sendTransport;
      // Here we must communicate our local parameters to our remote transport.
      try {
        await signal.request(
          'transport-connect',
          {
            transportId: transport.id,
            appData: {
              jwt
            },
            dtlsParameters
          });

        // Done in the server, tell our transport.
        callback();
      } catch (error) {
        // Something was wrong in server side.
        errback(error);
      }
  };

  const connectRecvHandler = async ({ dtlsParameters }, callback, errback) => {
    let transport = recvTransport;
      // Here we must communicate our local parameters to our remote transport.
      try {
        await signal.request(
          'transport-connect',
          {
            transportId: transport.id,
            appData: {
              jwt
            },
            dtlsParameters
          });

        // Done in the server, tell our transport.
        callback();
      } catch (error) {
        // Something was wrong in server side.
        errback(error);
      }
  };

  const produceHandler = async ({ 
      kind, 
      rtpParameters, 
      appData 
    }, callback, errback) => {
    // Here we must communicate our local parameters to our remote transport.
    try {
      const { id } = await signal.request(
        'produce',
        { 
          transportId : sendTransport.id,
          kind,
          rtpParameters,
          appData: {
            jwt
          }
        });

      // Done in the server, pass the response to our transport.
      callback({ id });
    } catch (error) {
      // Something was wrong in server side.
      errback(error);
    }
  };

  const produceDataHandler = async ({ sctpStreamParameters, label, protocol, appData }, callback, errback) => {
    // Here we must communicate our local parameters to our remote transport.
    try {
      const { id } = await signal.request(
        'produceData',
        { 
          transportId : sendTransport.id,
          sctpStreamParameters,
          label,
          protocol,
          appData: {
            jwt
          }
        });

      // Done in the server, pass the response to our transport.
      callback({ id });
    } catch (error) {
      // Something was wrong in server side.
      errback(error);
    }
  };

  const consumeHandler = async ( params, callback, errback) => {
    console.log('consume params', params)
    try {
      callback({ id });
    } catch (err) {
      errback(error);
    }
  }

  sendTransport.on('connect', connectSendHandler);
  sendTransport.on('produce', produceHandler);

  recvTransport.on('connect', connectRecvHandler);
  recvTransport.on('consume', consumeHandler)

  recvTransport.observer.on('newconsumer', (consumer) => {
    console.log('new consumer created', consumer);
  })
  // Set transport "producedata" event handler.
  sendTransport.on('producedata', produceDataHandler);


  // Lets create a consumer for each producer
  let producers = {};
  let consumers = {};
  let interval = 2.5; // How many seconds to check the available producers

  // Add video stream to UI
  const videoGrid = document.getElementById('video-grid');
  const addVideoStream = async (stream, consumer = null) => {
    const video = document.createElement('video');
    console.log('stream', stream, stream.getTracks())
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
      console.log('video', video)
        video.play()
    })
    videoGrid.append(video)

    if (consumer) {
      const res = await signal.request('consumerResume', {
        consumer_id: consumer.id,
        transportId: recvTransport.id,
        appData: {
          jwt
        }
      })
      if (res.success) {
        consumers[consumer.producerId].resume()
      }
      console.log('resume consumer?', res)
    }
  }

  // We do all checking for new producers on the client side (for now)
  setInterval(async () => {
    let fetchProducers = await signal.request('producers')
  
    fetchProducers.forEach(async (producer) => {
      const producerId = producer.id;
     
      if (!producers[producerId]) {
        console.log('creating consumer for producer ', producerId)
        producers[producerId] = producerId;
        // Now lets create that consumer
        const consumerData = {
          producerId,
          transportId: recvTransportParams.id,
          appData: {
            jwt
          },
          rtpParameters: producer.consumableRtpParameters,
          rtpCapabilities: routerRtpCapabilities,
          kind: producer.kind
        };
        
        const consumerResponse = await signal.request('consumer', consumerData)
        console.log('consumerResponse', consumerResponse)
        const consumer = await recvTransport.consume(consumerResponse)
  
        consumers[producerId] = consumer;
        const { track } = consumer;
        let stream = new MediaStream([ track ]);
        addVideoStream(stream, consumer);
      }
    })
  }, (interval * 1000))

  
  // Produce our webcam video.
  window.goLive = async () => {
    // Check whether we can produce video to the router.
    if (device.canProduce('video')) {
    
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        addVideoStream(stream);
        const webcamTrack = stream.getVideoTracks()[0];
        const webcamProducer = await sendTransport.produce({ track: webcamTrack });
        console.log('webcam producer', webcamProducer)
        return true;
    } else {
      alert('Cannot produce video');
    }
  }

  // Produce data (DataChannel).
  // const dataProducer =  await sendTransport.produceData({ ordered: true, label: 'foo' });
}
