// Remaining JavaScript functionality for Secure Chat
// This completes the app.js file for your HTML application

// Search functionality
async function searchUsers(query) {
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    const searchResultsSection = document.getElementById('search-results-section');
    const searchResults = document.getElementById('search-results');
    
    if (!query || query.length < 2) {
        searchResultsSection.classList.add('d-none');
        searchResults.innerHTML = '';
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const data = await apiRequest(`/search-users?query=${encodeURIComponent(query)}`);
            
            if (data.success) {
                searchResults.innerHTML = '';
                
                if (data.users.length === 0) {
                    searchResults.innerHTML = '<div class="px-3 py-2 text-white-50 small">No users found</div>';
                } else {
                    data.users.forEach(user => {
                        const userElement = document.createElement('div');
                        userElement.className = 'chat-item';
                        
                        const isFriend = friends.has(user.userKey);
                        const isBlocked = blockedUsers.has(user.userKey);
                        
                        userElement.innerHTML = `
                            <div class="chat-item-avatar">
                                ${getUserInitials(user.username)}
                            </div>
                            <div class="chat-item-info">
                                <div class="chat-item-name">${user.username}</div>
                                <div class="chat-item-message">${user.userKey} - ${user.status}</div>
                            </div>
                            <div class="d-flex gap-2">
                                ${!isFriend && !isBlocked ? 
                                    `<button class="btn btn-sm btn-primary" onclick="sendFriendRequestToUser('${user.userKey}')">
                                        <i class="fas fa-user-plus"></i>
                                    </button>` : ''}
                                ${isFriend ? 
                                    `<button class="btn btn-sm btn-success" onclick="openChat('${user.userKey}', 'direct')">
                                        <i class="fas fa-comments"></i>
                                    </button>` : ''}
                                ${isBlocked ? 
                                    '<span class="badge bg-danger">Blocked</span>' : ''}
                            </div>
                        `;
                        
                        searchResults.appendChild(userElement);
                    });
                }
                
                searchResultsSection.classList.remove('d-none');
            }
        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = '<div class="px-3 py-2 text-danger small">Search failed</div>';
        }
    }, 300);
}

// Friend management functions
async function sendFriendRequestToUser(userKey) {
    try {
        const data = await apiRequest('/send-friend-request', {
            method: 'POST',
            body: JSON.stringify({ targetUserKey: userKey })
        });
        
        if (data.success) {
            showToast('Friend request sent!', 'success');
            searchUsers(document.getElementById('search-users').value);
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        showToast('Failed to send friend request', 'error');
    }
}

function showAddFriend() {
    const modal = new bootstrap.Modal(document.getElementById('add-friend-modal'));
    modal.show();
}

async function sendFriendRequest(event) {
    event.preventDefault();
    const userKey = document.getElementById('friend-user-key').value.trim().toUpperCase();
    
    if (!userKey) {
        showToast('Please enter a user key', 'warning');
        return;
    }
    
    try {
        const data = await apiRequest('/send-friend-request', {
            method: 'POST',
            body: JSON.stringify({ targetUserKey: userKey })
        });
        
        if (data.success) {
            showToast('Friend request sent!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('add-friend-modal')).hide();
            document.getElementById('friend-user-key').value = '';
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error sending friend request:', error);
        showToast('Failed to send friend request', 'error');
    }
}

async function removeFriend(userKey) {
    if (!confirm('Are you sure you want to remove this friend?')) {
        return;
    }
    
    try {
        const data = await apiRequest('/remove-friend', {
            method: 'POST',
            body: JSON.stringify({ friendUserKey: userKey })
        });
        
        if (data.success) {
            showToast('Friend removed', 'success');
            friends.delete(userKey);
            renderFriendsList();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error removing friend:', error);
        showToast('Failed to remove friend', 'error');
    }
}

async function blockUser(userKey, action) {
    const actionText = action === 'block' ? 'block' : 'unblock';
    
    if (!confirm(`Are you sure you want to ${actionText} this user?`)) {
        return;
    }
    
    try {
        const data = await apiRequest('/block-user', {
            method: 'POST',
            body: JSON.stringify({ targetUserKey: userKey, action })
        });
        
        if (data.success) {
            showToast(`User ${actionText}ed successfully`, 'success');
            
            if (action === 'block') {
                blockedUsers.add(userKey);
                friends.delete(userKey);
            } else {
                blockedUsers.delete(userKey);
            }
            
            renderFriendsList();
            renderBlockedUsersList();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error(`Error ${actionText}ing user:`, error);
        showToast(`Failed to ${actionText} user`, 'error');
    }
}

function showFriendRequestNotification(request) {
    showToast(`Friend request from ${request.fromUsername}`, 'info');
    
    if (confirm(`${request.fromUsername} wants to be your friend. Accept?`)) {
        respondToFriendRequest(request.id, 'accept');
    } else {
        respondToFriendRequest(request.id, 'reject');
    }
}

async function respondToFriendRequest(requestId, action) {
    try {
        const data = await apiRequest('/respond-friend-request', {
            method: 'POST',
            body: JSON.stringify({ requestId, action })
        });
        
        if (data.success) {
            showToast(`Friend request ${action}ed`, 'success');
            if (action === 'accept') {
                loadFriends();
            }
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error responding to friend request:', error);
        showToast('Failed to respond to friend request', 'error');
    }
}

// Group management functions
function showCreateGroup() {
    const groupMembersSelect = document.getElementById('group-members');
    groupMembersSelect.innerHTML = '';
    
    if (friends.size === 0) {
        groupMembersSelect.innerHTML = '<option disabled>No friends available</option>';
    } else {
        friends.forEach(friend => {
            const option = document.createElement('option');
            option.value = friend.userKey;
            option.textContent = friend.username;
            groupMembersSelect.appendChild(option);
        });
    }
    
    const modal = new bootstrap.Modal(document.getElementById('create-group-modal'));
    modal.show();
}

async function createGroup(event) {
    event.preventDefault();
    const groupName = document.getElementById('group-name').value.trim();
    const selectedMembers = Array.from(document.getElementById('group-members').selectedOptions)
        .map(option => option.value);
    
    if (!groupName) {
        showToast('Please enter a group name', 'warning');
        return;
    }
    
    if (selectedMembers.length === 0) {
        showToast('Please select at least one friend', 'warning');
        return;
    }
    
    try {
        const data = await apiRequest('/create-group', {
            method: 'POST',
            body: JSON.stringify({ groupName, memberKeys: selectedMembers })
        });
        
        if (data.success) {
            showToast('Group created successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('create-group-modal')).hide();
            document.getElementById('group-name').value = '';
            loadGroups();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error creating group:', error);
        showToast('Failed to create group', 'error');
    }
}

async function leaveGroup(groupId) {
    if (!confirm('Are you sure you want to leave this group?')) {
        return;
    }
    
    try {
        const data = await apiRequest('/leave-group', {
            method: 'POST',
            body: JSON.stringify({ groupId })
        });
        
        if (data.success) {
            showToast('Left group successfully', 'success');
            groups.delete(groupId);
            renderGroupsList();
            
            if (currentChat === groupId) {
                currentChat = null;
                currentChatType = null;
                document.getElementById('current-chat-name').textContent = 'Select a chat';
                document.getElementById('message-input').disabled = true;
                document.getElementById('chat-messages').innerHTML = `
                    <div class="text-center text-white-50 mt-5">
                        <i class="fas fa-comments fa-3x mb-3 opacity-50"></i>
                        <h5>Welcome to Secure Chat</h5>
                        <p>Select a friend or group to start chatting</p>
                    </div>
                `;
            }
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error leaving group:', error);
        showToast('Failed to leave group', 'error');
    }
}

// Hidden chat functions
function showHiddenChatModal(chatId) {
    document.getElementById('hidden-chat-modal').setAttribute('data-chat-id', chatId);
    const modal = new bootstrap.Modal(document.getElementById('hidden-chat-modal'));
    modal.show();
}

async function unlockHiddenChat(event) {
    event.preventDefault();
    const chatId = document.getElementById('hidden-chat-modal').getAttribute('data-chat-id');
    const password = document.getElementById('hidden-chat-password').value;
    
    try {
        const data = await apiRequest('/verify-chat-password', {
            method: 'POST',
            body: JSON.stringify({ chatId, password })
        });
        
        if (data.success) {
            showToast('Chat unlocked!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('hidden-chat-modal')).hide();
            document.getElementById('hidden-chat-password').value = '';
            
            const hiddenChat = hiddenChats.get(chatId);
            if (hiddenChat) {
                hiddenChat.isLocked = false;
                renderHiddenChatsList();
            }
            
            const chatType = hiddenChat?.chatType || 'direct';
            openChat(chatId, chatType);
        } else {
            showToast('Invalid password', 'error');
        }
    } catch (error) {
        console.error('Error unlocking chat:', error);
        showToast('Failed to unlock chat', 'error');
    }
}

function toggleHideChat() {
    if (!currentChat) {
        showToast('No chat selected', 'warning');
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('toggle-chat-modal'));
    modal.show();
}

async function setHiddenChat(event) {
    event.preventDefault();
    const password = document.getElementById('toggle-chat-password').value;
    
    if (!password) {
        showToast('Please enter a password', 'warning');
        return;
    }
    
    try {
        const data = await apiRequest('/set-hidden-chat', {
            method: 'POST',
            body: JSON.stringify({
                chatId: currentChat,
                password: password,
                isHidden: true,
                chatType: currentChatType
            })
        });
        
        if (data.success) {
            showToast('Chat hidden successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('toggle-chat-modal')).hide();
            document.getElementById('toggle-chat-password').value = '';
            loadHiddenChats();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error hiding chat:', error);
        showToast('Failed to hide chat', 'error');
    }
}

// Status update function
async function updateStatus(status) {
    if (!websocket) return;
    
    websocket.send(JSON.stringify({
        type: 'status_update',
        status: status
    }));
    
    const indicator = document.getElementById('user-status-indicator');
    indicator.className = `status-indicator status-${status}`;
}

// Settings functions
function showSettings() {
    document.getElementById('settings-username').value = currentUser.username;
    const modal = new bootstrap.Modal(document.getElementById('settings-modal'));
    modal.show();
}

async function updateProfile(event) {
    event.preventDefault();
    const username = document.getElementById('settings-username').value.trim();
    
    if (!username || username === currentUser.username) {
        showToast('No changes to save', 'info');
        return;
    }
    
    try {
        const data = await apiRequest('/update-profile', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
        
        if (data.success) {
            showToast('Profile updated successfully!', 'success');
            currentUser.username = username;
            localStorage.setItem('user', JSON.stringify(currentUser));
            document.getElementById('user-username').textContent = username;
            document.getElementById('user-avatar-text').textContent = username.charAt(0).toUpperCase();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Failed to update profile', 'error');
    }
}

async function changePassword(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    
    if (!currentPassword || !newPassword) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters', 'warning');
        return;
    }
    
    try {
        const data = await apiRequest('/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        if (data.success) {
            showToast('Password changed successfully!', 'success');
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showToast('Failed to change password', 'error');
    }
}

// WebRTC Call functions
async function startCall(callType) {
    if (!currentChat || currentChatType !== 'direct') {
        showToast('Can only call direct contacts', 'warning');
        return;
    }
    
    try {
        const mediaConstraints = {
            audio: true,
            video: callType === 'video'
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        document.getElementById('local-video').srcObject = localStream;
        
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            document.getElementById('remote-video').srcObject = remoteStream;
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && websocket) {
                websocket.send(JSON.stringify({
                    type: 'call_ice_candidate',
                    to: currentChat,
                    candidate: event.candidate,
                    callId: currentCall
                }));
            }
        };
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        currentCall = Date.now().toString();
        isCallActive = true;
        
        websocket.send(JSON.stringify({
            type: 'call_offer',
            to: currentChat,
            offer: offer,
            callId: currentCall,
            callType: callType
        }));
        
        showCallInterface();
        document.getElementById('call-status').textContent = 'Calling...';
        document.getElementById('call-participant').textContent = friends.get(currentChat)?.username || currentChat;
        
    } catch (error) {
        console.error('Error starting call:', error);
        showToast('Failed to start call. Please check camera/microphone permissions.', 'error');
        endCall();
    }
}

function showCallInterface() {
    document.getElementById('call-interface').style.display = 'flex';
}

function hideCallInterface() {
    document.getElementById('call-interface').style.display = 'none';
}

async function acceptCall() {
    try {
        const mediaConstraints = {
            audio: true,
            video: currentCall?.callType === 'video'
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        document.getElementById('local-video').srcObject = localStream;
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        websocket.send(JSON.stringify({
            type: 'call_answer',
            to: currentCall.from,
            answer: answer,
            callId: currentCall.callId
        }));
        
        bootstrap.Modal.getInstance(document.getElementById('incoming-call-modal')).hide();
        
        showCallInterface();
        document.getElementById('call-status').textContent = 'Connected';
        
        isCallActive = true;
        
    } catch (error) {
        console.error('Error accepting call:', error);
        showToast('Failed to accept call', 'error');
        rejectCall();
    }
}

function rejectCall() {
    if (currentCall) {
        websocket.send(JSON.stringify({
            type: 'call_end',
            to: currentCall.from,
            callId: currentCall.callId
        }));
    }
    
    endCall();
    bootstrap.Modal.getInstance(document.getElementById('incoming-call-modal')).hide();
}

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (remoteStream) {
        remoteStream = null;
    }
    
    if (currentCall && websocket && isCallActive) {
        websocket.send(JSON.stringify({
            type: 'call_end',
            to: currentChat,
            callId: currentCall
        }));
    }
    
    currentCall = null;
    isCallActive = false;
    hideCallInterface();
    
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
}

function toggleMute() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        
        const muteBtn = document.querySelector('.call-btn.mute');
        const icon = muteBtn.querySelector('i');
        
        if (audioTracks[0]?.enabled) {
            icon.className = 'fas fa-microphone';
            muteBtn.title = 'Mute';
        } else {
            icon.className = 'fas fa-microphone-slash';
            muteBtn.title = 'Unmute';
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        
        const videoBtn = document.querySelector('.call-btn.mute:nth-child(2)');
        const icon = videoBtn.querySelector('i');
        
        if (videoTracks[0]?.enabled) {
            icon.className = 'fas fa-video';
            videoBtn.title = 'Turn Camera Off';
        } else {
            icon.className = 'fas fa-video-slash';
            videoBtn.title = 'Turn Camera On';
        }
    }
}

// Handle incoming call messages
function handleCallMessage(data) {
    switch (data.type) {
        case 'call_offer':
            handleIncomingCall(data);
            break;
            
        case 'call_answer':
            handleCallAnswer(data);
            break;
            
        case 'call_ice_candidate':
            handleIceCandidate(data);
            break;
            
        case 'call_end':
            endCall();
            break;
    }
}

async function handleIncomingCall(data) {
    if (isCallActive) {
        websocket.send(JSON.stringify({
            type: 'call_end',
            to: data.from,
            callId: data.callId
        }));
        return;
    }
    
    peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });
    
    peerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        document.getElementById('remote-video').srcObject = remoteStream;
    };
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && websocket) {
            websocket.send(JSON.stringify({
                type: 'call_ice_candidate',
                to: data.from,
                candidate: event.candidate,
                callId: data.callId
            }));
        }
    };
    
    await peerConnection.setRemoteDescription(data.offer);
    
    currentCall = {
        from: data.from,
        callId: data.callId,
        callType: data.callType
    };
    
    document.getElementById('caller-name').textContent = data.fromUsername || data.from;
    document.getElementById('caller-avatar').textContent = getUserInitials(data.fromUsername || data.from);
    document.getElementById('call-type-indicator').textContent = data.callType === 'video' ? 'Video Call' : 'Voice Call';
    
    const modal = new bootstrap.Modal(document.getElementById('incoming-call-modal'));
    modal.show();
}

async function handleCallAnswer(data) {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(data.answer);
        document.getElementById('call-status').textContent = 'Connected';
        isCallActive = true;
    }
}

async function handleIceCandidate(data) {
    if (peerConnection && data.candidate) {
        await peerConnection.addIceCandidate(data.candidate);
    }
}

// Voice recording functionality
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

async function toggleVoiceRecording() {
    const recordBtn = document.getElementById('record-button');
    const icon = recordBtn.querySelector('i');
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            recordedChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = async () => {
                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                await uploadVoiceMessage(blob);
                
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            
            icon.className = 'fas fa-stop';
            recordBtn.classList.add('btn-danger');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            showToast('Failed to start recording. Please check microphone permissions.', 'error');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        
        icon.className = 'fas fa-microphone';
        recordBtn.classList.remove('btn-danger');
    }
}

async function uploadVoiceMessage(audioBlob) {
    if (!currentChat) {
        showToast('Please select a chat first', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('media', audioBlob, 'voice_message.webm');
    formData.append('chatId', currentChat);
    formData.append('chatType', currentChatType);
    
    try {
        const response = await fetch('/upload-media', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Voice message sent!', 'success');
        } else {
            showToast(data.message || 'Upload failed', 'error');
        }
    } catch (error) {
        console.error('Voice upload error:', error);
        showToast('Failed to send voice message', 'error');
    }
}

// Message context menu and deletion
function showMessageContextMenu(event, messageId) {
    const existingMenu = document.querySelector('.message-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'message-context-menu';
    menu.style.cssText = `
        position: fixed;
        top: ${event.clientY}px;
        left: ${event.clientX}px;
        background: var(--darker-bg);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        padding: 8px 0;
        z-index: 9999;
        min-width: 120px;
    `;
    
    menu.innerHTML = `
        <div class="px-3 py-2 text-danger" style="cursor: pointer;" onclick="deleteMessage('${messageId}')">
            <i class="fas fa-trash me-2"></i>Delete
        </div>
    `;
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', function removeMenu() {
            menu.remove();
            document.removeEventListener('click', removeMenu);
        });
    }, 100);
}

async function deleteMessage(messageId) {
    try {
        const data = await apiRequest(`/message/${messageId}?chatId=${currentChat}&chatType=${currentChatType}`, {
            method: 'DELETE'
        });
        
        if (data.success) {
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            showToast('Message deleted', 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Failed to delete message', 'error');
    }
}

function handleMessageDeleted(data) {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
}

// Media modal for viewing images/videos
function openMediaModal(mediaUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content bg-dark">
                <div class="modal-header">
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center">
                    <img src="${mediaUrl}" class="img-fluid" style="max-height: 80vh;">
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

// Admin functions
async function showAdminUsers() {
    try {
        const data = await apiRequest('/admin/users');
        
        if (data.success) {
            const usersList = document.getElementById('admin-users-list');
            usersList.innerHTML = '';
            
            data.users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.userKey}</td>
                    <td>${user.username}</td>
                    <td>${user.email}</td>
                    <td><span class="badge bg-${user.status === 'online' ? 'success' : 'secondary'}">${user.status}</span></td>
                    <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-warning" onclick="showAdminResetPassword('${user.userKey}')">
                                Reset Password
                            </button>
                            ${!user.isAdmin ? `<button class="btn btn-outline-danger" onclick="adminDeleteUser('${user.userKey}')">Delete</button>` : ''}
                        </div>
                    </td>
                `;
                usersList.appendChild(row);
            });
            
            const modal = new bootstrap.Modal(document.getElementById('admin-users-modal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
    }
}

async function showAdminStats() {
    try {
        const data = await apiRequest('/admin/stats');
        
        if (data.success) {
            const statsContent = document.getElementById('admin-stats-content');
            statsContent.innerHTML = '';
            
            const stats = [
                { label: 'Total Users', value: data.stats.totalUsers, icon: 'fas fa-users', color: 'primary' },
                { label: 'Online Users', value: data.stats.onlineUsers, icon: 'fas fa-circle', color: 'success' },
                { label: 'Total Groups', value: data.stats.totalGroups, icon: 'fas fa-layer-group', color: 'info' },
                { label: 'Total Messages', value: data.stats.totalMessages, icon: 'fas fa-comments', color: 'warning' },
                { label: 'Verified Users', value: data.stats.verifiedUsers, icon: 'fas fa-check-circle', color: 'success' },
                { label: 'Total Friendships', value: data.stats.totalFriendships, icon: 'fas fa-handshake', color: 'secondary' }
            ];
            
            stats.forEach(stat => {
                const statCard = document.createElement('div');
                statCard.className = 'col-md-6';
                statCard.innerHTML = `
                    <div class="card bg-${stat.color} text-white">
                        <div class="card-body d-flex align-items-center">
                            <div class="me-3">
                                <i class="${stat.icon} fa-2x"></i>
                            </div>
                            <div>
                                <h5 class="card-title mb-0">${stat.value}</h5>
                                <p class="card-text">${stat.label}</p>
                            </div>
                        </div>
                    </div>
                `;
                statsContent.appendChild(statCard);
            });
            
            const modal = new bootstrap.Modal(document.getElementById('admin-stats-modal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Failed to load stats', 'error');
    }
}

function showAdminResetPassword(userKey) {
    document.getElementById('admin-reset-user-key').value = userKey;
    const modal = new bootstrap.Modal(document.getElementById('admin-reset-password-modal'));
    modal.show();
}

async function adminResetPassword(event) {
    event.preventDefault();
    const userKey = document.getElementById('admin-reset-user-key').value;
    const newPassword = document.getElementById('admin-reset-new-password').value;
    
    if (!newPassword || newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'warning');
        return;
    }
    
    try {
        const data = await apiRequest('/admin/reset-password', {
            method: 'POST',
            body: JSON.stringify({ targetUserKey: userKey, newPassword })
        });
        
        if (data.success) {
            showToast('Password reset successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('admin-reset-password-modal')).hide();
            document.getElementById('admin-reset-new-password').value = '';
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        showToast('Failed to reset password', 'error');
    }
}

async function adminDeleteUser(userKey) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        const data = await apiRequest(`/admin/user/${userKey}`, {
            method: 'DELETE'
        });
        
        if (data.success) {
            showToast('User deleted successfully', 'success');
            showAdminUsers(); // Refresh the users list
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user', 'error');
    }
}

// Enhanced WebSocket event handlers
function handleFriendRequest(data) {
    showToast(`Friend request from ${data.fromUsername}`, 'info');
    
    // Create notification with action buttons
    const notification = document.createElement('div');
    notification.className = 'alert alert-info alert-dismissible fade show';
    notification.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        <strong>Friend Request</strong><br>
        ${data.fromUsername} wants to be your friend.
        <div class="mt-2">
            <button class="btn btn-success btn-sm me-2" onclick="respondToFriendRequest('${data.from}:${currentUser.userKey}', 'accept'); this.closest('.alert').remove();">
                Accept
            </button>
            <button class="btn btn-danger btn-sm" onclick="respondToFriendRequest('${data.from}:${currentUser.userKey}', 'reject'); this.closest('.alert').remove();">
                Reject
            </button>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 30000);
}

function handleFriendAdded(data) {
    showToast('New friend added!', 'success');
    loadFriends(); // Reload friends list
}

function handleFriendRemoved(data) {
    showToast('Friend removed', 'info');
    friends.delete(data.userKey);
    renderFriendsList();
}

function handleFriendStatusUpdate(data) {
    const friend = friends.get(data.userKey);
    if (friend) {
        friend.status = data.status;
        renderFriendsList();
    }
}

function handleGroupCreated(data) {
    showToast('Added to a new group!', 'success');
    loadGroups(); // Reload groups
}

function handleUserLeftGroup(data) {
    if (data.userKey === currentUser.userKey) {
        return;
    }
    
    showToast(`User left the group`, 'info');
}

// Utility functions for responsive design
function handleResize() {
    const sidebar = document.getElementById('sidebar');
    
    if (window.innerWidth > 768) {
        sidebar.classList.remove('show');
        sidebar.style.transform = '';
    } else {
        if (!sidebar.classList.contains('show')) {
            sidebar.style.transform = 'translateX(-100%)';
        }
    }
}

// Event listeners
window.addEventListener('resize', handleResize);
window.addEventListener('load', handleResize);

// Prevent zoom on double tap for mobile
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

let lastTouchEnd = 0;

// Enhanced error handling for WebSocket
function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    
    if (!navigator.onLine) {
        showToast('You are offline. Please check your internet connection.', 'warning');
    } else {
        showToast('Connection error. Attempting to reconnect...', 'warning');
    }
}

// Auto-reconnect logic with exponential backoff
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function attemptReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
        showToast('Failed to reconnect. Please refresh the page.', 'error');
        return;
    }
    
    const delay = Math.pow(2, reconnectAttempts) * 1000; // Exponential backoff
    reconnectAttempts++;
    
    setTimeout(() => {
        if (currentUser && !websocket) {
            connectWebSocket();
        }
    }, delay);
}

// Progressive Web App (PWA) functionality
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration.scope);
                
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('App updated! Refresh to use new version.', 'info');
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }
}

// Install prompt for PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    
    const installBanner = document.createElement('div');
    installBanner.className = 'alert alert-primary alert-dismissible fade show';
    installBanner.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
    installBanner.innerHTML = `
        <strong>Install App</strong><br>
        Install Secure Chat for a better experience!
        <div class="mt-2">
            <button class="btn btn-primary btn-sm" onclick="installApp()">Install</button>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(installBanner);
});

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                showToast('App installed successfully!', 'success');
            } else {
                console.log('User dismissed the install prompt');
            }
            
            deferredPrompt = null;
            
            const banner = document.querySelector('.alert-primary');
            if (banner) {
                banner.remove();
            }
        });
    }
}

// Theme toggle functionality
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    showToast(`Switched to ${newTheme} theme`, 'info');
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
}

// Auto-scroll to bottom when new messages arrive
const observeNewMessages = () => {
    const chatMessages = document.getElementById('chat-messages');
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                const isNearBottom = chatMessages.scrollTop + chatMessages.clientHeight >= 
                                   chatMessages.scrollHeight - 100;
                
                if (isNearBottom) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        });
    });
    
    observer.observe(chatMessages, { childList: true });
};

// Initialize message observer
observeNewMessages();

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl/Cmd + Enter to send message
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        const messageInput = document.getElementById('message-input');
        if (messageInput === document.activeElement && messageInput.value.trim()) {
            sendMessage({ preventDefault: () => {} });
        }
    }
    
    // Escape to close modals or clear current chat
    if (event.key === 'Escape') {
        const activeModal = document.querySelector('.modal.show');
        if (activeModal) {
            const modalInstance = bootstrap.Modal.getInstance(activeModal);
            if (modalInstance) {
                modalInstance.hide();
            }
        } else if (currentChat) {
            currentChat = null;
            currentChatType = null;
            document.getElementById('current-chat-name').textContent = 'Select a chat';
            document.getElementById('message-input').disabled = true;
            document.querySelectorAll('.chat-item').forEach(item => {
                item.classList.remove('active');
            });
        }
    }
    
    // F5 to refresh friends/groups
    if (event.key === 'F5' && event.ctrlKey) {
        event.preventDefault();
        loadFriends();
        loadGroups();
        loadHiddenChats();
        loadBlockedUsers();
        showToast('Data refreshed', 'info');
    }
});

// Handle page visibility change (for presence/status)
document.addEventListener('visibilitychange', function() {
    if (websocket && currentUser) {
        const status = document.hidden ? 'away' : 'online';
        websocket.send(JSON.stringify({
            type: 'status_update',
            status: status
        }));
    }
});

// Handle online/offline events
window.addEventListener('online', function() {
    showToast('Connection restored', 'success');
    if (currentUser && (!websocket || websocket.readyState !== WebSocket.OPEN)) {
        connectWebSocket();
    }
});

window.addEventListener('offline', function() {
    showToast('You are offline', 'warning');
});

// Cleanup function for when user leaves the page
window.addEventListener('beforeunload', function() {
    if (websocket) {
        websocket.close(1000, 'Page unload');
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Register service worker
    registerServiceWorker();
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
    
    // Handle form submissions with Enter key
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]').forEach(input => {
        input.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                const form = this.closest('form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        });
    });
});

// Export functions for global access
window.SecureChat = {
    // Core functions
    login: handleLogin,
    register: handleRegister,
    logout: logout,
    
    // Chat functions
    openChat: openChat,
    sendMessage: sendMessage,
    
    // Friend functions
    addFriend: sendFriendRequest,
    removeFriend: removeFriend,
    blockUser: blockUser,
    
    // Group functions
    createGroup: createGroup,
    leaveGroup: leaveGroup,
    
    // Call functions
    startCall: startCall,
    endCall: endCall,
    
    // Admin functions
    showAdminUsers: showAdminUsers,
    showAdminStats: showAdminStats,
    
    // Utility functions
    showToast: showToast,
    toggleTheme: toggleTheme
};
