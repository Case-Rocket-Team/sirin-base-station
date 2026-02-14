import { useState, useEffect } from "react";
import { Channel, invoke } from '@tauri-apps/api/core';

function App() {
  const [data, setData] = useState("no data :(");

  useEffect(() => {
    const onLoraConnMsg = new Channel();
    const onPacket = new Channel();

    onLoraConnMsg.onmessage = msg => {
      console.log(msg);
    }

    onPacket.onmessage = msg => {
      console.log(msg);

      setData(JSON.stringify(msg, null, 4))
    }

    invoke('listen_to_lora', {
      onLoraConnMsg,
      onPacket
    });
  }, []);

  return (
    <main className="">
      <h1 className='text-2xl font-black'>Sirin base station</h1>
      <pre>{data}</pre>
    </main>
  );
}

export default App;
