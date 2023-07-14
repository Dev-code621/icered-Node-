const socket = io('/');
const videoGrid = document.getElementById('video-grid');

const myPeer = new Peer(undefined, {
    host: '/',
    port: '3001'
});

window.peers = [];

const myVideo = document.createElement('video');
myVideo.muted = true; // Mute Ourself

navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then( stream => {
    addVideoStream(myVideo, stream);

    myPeer.on('call', call => {
        call.answer(stream);
        const video = document.createElement('video')
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream)
        })
    })

    socket.on('user-connected', userId => {
        connectToNewUser(userId, stream);
    })
});

myPeer.on('open', id => {
    socket.emit('join-room', ROOM_ID, id);
})

socket.on('user-disconnected', userId => {
    console.log('user was disconnected', userId)
    console.log('peers', window.peers)
    window.peers.map((thePeer, i) => {
        console.log('peer id', thePeer, i)
        if (thePeer.id === userId) {
            console.log('closing peer', thePeer)
            thePeer.call.close()
        }
    })
})


const connectToNewUser = (userId, stream) => {
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream)
    })
    call.on('close', () => {
        video.remove();
    })

    peers.push({ id: userId, call });
    console.log('new peers', peers)
}

const addVideoStream = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play()
    })
    videoGrid.append(video)
}