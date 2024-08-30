import logo from './logo.svg';
import './App.css';
import StreamPlayer from './Stream';

function App() {
  return (
    <div className="App">
      <StreamPlayer streamId="12345" />
    </div>
  );
}

export default App;
