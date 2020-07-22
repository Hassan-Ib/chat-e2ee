import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';

import {
  pubnubInit,
  getUsersInChannel,
  fetchMessages,
  getUserSessionID,
  createUserSessionID,
  storeUserSessionID,
  getKeyPair,
  createKeyPair,
  storeKeyPair
} from './helpers';

import { sendMessage, updatePublicKey, getPublicKey } from '../../service';
import './style.css';

// create your key at https://www.pubnub.com/
const subscribeKey = process.env.REACT_APP_PUBNUB_SUB_KEY;

const Chat = () => {
  const [pubnubIns, setPubnubIns] = useState(null);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [usersInChannel, setUsers] = useState([]);
  const [keyPair, setKeyPair] = useState(null);
  const [receiverPublicKey, setReceiverPublicKey] = useState(null);

  // const keyPairRef = useRef(keyPair);
  const pubnubInsRef = useRef(pubnubIns);

  const { uuid } = useParams();

  const encryptChannel = (uuid) => {
    console.log('Encrypting channel');

    let _keyPair = getKeyPair(uuid);
    if (!_keyPair) {
      _keyPair = createKeyPair();
      storeKeyPair(uuid, _keyPair);

      updatePublicKey({
        channel: uuid,
        publicKey: _keyPair.publicKey,
        sender: userId
      });
    }
    console.log(_keyPair);
    setKeyPair(_keyPair);
  };

  let userId = getUserSessionID(uuid);

  // if not in session, lets create one and store.
  if (!userId) {
    userId = createUserSessionID(uuid);
    storeUserSessionID(uuid, userId);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage({ uuid, userId, text });
  };

  const initChat = async () => {
    const pubnub = pubnubInit({ subscribeKey, userId, uuid });

    setPubnubIns(() => {
      pubnubInsRef.current = pubnub;
      return pubnub;
    });

    // TODO: handle error
    const messages = await fetchMessages(pubnub, uuid);
    setMessages(messages);

    const usersInChannel = await getUsersInChannel(pubnub, uuid);
    setUsers(usersInChannel);

    pubnub.addListener({
      status: (statusEvent) => {
        // console.log('statusEvent', statusEvent);
      },
      message: (msg) => {
        if (msg.channel === uuid) {
          setMessages((prevMsg) => prevMsg.concat(msg.message));
        }
      },
      presence: async (presenceEvent) => {
        // some user might have joined or left
        // let's update the userlist
        const usersInChannel = await getUsersInChannel(pubnub, uuid);
        setUsers(usersInChannel);

        if (presenceEvent.action === 'join') {
          if (presenceEvent.uuid !== userId) {
            const key = await getPublicKey({ userId: presenceEvent.uuid, channel: uuid });
            setReceiverPublicKey(key.publicKey);
            console.log(key);
          }
        }
      }
    });
  };

  useEffect(() => {
    if (!subscribeKey) {
      throw new Error('Configure subscribeKey (PUBNUB)');
    }
    encryptChannel(uuid);
    initChat();
  }, [uuid]);

  return (
    <>
      <div>
        <h3>Edit ./client/chat/index.js and make me beautiful</h3>
      </div>
      <br />
      <div>
        <b>Encryption</b>
        <div>Your private key: {keyPair ? '*************' : '--'}</div>
        <div>Your public key:</div>
        <div className="key-container">{keyPair ? btoa(keyPair.publicKey) : '--'}</div>
        <br />
        <div>---</div>
        <br />
        Her public key:
        <div className="key-container">
          {receiverPublicKey ? btoa(receiverPublicKey) : 'Awiting public key'}
        </div>
      </div>
      <br />
      <div>
        <b>Users in this channel</b> :
        <div>
          {usersInChannel.map((u) => (
            <div key={u.uuid}>
              <b>{u.uuid === userId ? 'You' : 'Her'}</b> - {u.uuid}
            </div>
          ))}
        </div>
      </div>
      <br />
      <div>
        {messages.map(({ body, sender }, i) => (
          <div key={i}>
            <b>{sender === userId ? 'You: ' : 'Her: '}</b>
            {body}
          </div>
        ))}
      </div>
      <div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="write message"
            onChange={(e) => setText(e.target.value)}
            value={text}
          />
        </form>
      </div>
    </>
  );
};

export default Chat;
