import './App.css';
import axios from 'axios';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import SaveAlt from '@mui/icons-material/SaveAlt';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Delete from '@mui/icons-material/Delete';
import useWebSocket from 'react-use-websocket';

import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

const queryClient = new QueryClient()
const WS_URL = 'ws://127.0.0.1:8000';


const parseRecords = (data) => {
  let rating, win, accuracy;
  const parsed = JSON.parse(data)

  if (parsed.white.username === 'gandalf868') {
    win = parsed.white.result === 'win'
    accuracy = parsed.accuracies.white
    rating = parsed.black.rating
  } else {
    win = parsed.black.result === 'win'
    accuracy = parsed.accuracies.black
    rating = parsed.white.rating
  }

  return {rating, win, accuracy}
}

function App() {

  useWebSocket(WS_URL, {
    onOpen: () => {
      console.log('WebSocket connection established.');
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Games />
    </QueryClientProvider>
  );
}

function Games() {

  const { lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
  });

  const queryClient = useQueryClient()

  const getGames = async () => {
    const {data} = await axios.get('http://localhost:8000/games')
    return data
  }

  const getRecords = async () => {
    const {data} = await axios.get('http://localhost:8000/records')
    return data
  }
  
  const query = useQuery({ queryKey: ['games'], queryFn: getGames })

  const records = useQuery({ queryKey: ['records'], queryFn: getRecords })

  const deleteFromQueue = useMutation({
    mutationFn: (id) => {
      return axios.delete(`http://localhost:8000/games/${id}`)
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries(['games'])
  
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData(['games'])
  
      // Optimistically update to the new value
      queryClient.setQueryData(['games'], old => old.filter((t) => t.id !== id))
  
      // Return a context object with the snapshotted value
      return { previousTasks }
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, id , context) => {
      queryClient.setQueryData(['games'], context.previousTasks)
    },
    // Always refetch after error or success:
    onSettled: (newData, error, id) => {
      queryClient.invalidateQueries(['games'])
    },
  })

  const saveGame = useMutation({
    mutationFn: ({chessUser, twitchUser}) => {
      return axios.post('http://localhost:8000/records', {chessUser, twitchUser})
    },
    onSuccess: data => {
      queryClient.invalidateQueries(['records'])
    }
  })

  const updateGame = useMutation({
    mutationFn: async (id) => {
      return await axios.put(`http://localhost:8000/games/${id}`)
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['games'])
    }
  })

  
  let array = records.data ? records.data.map(record => parseRecords(record.data)) : []

  const wins = array.reduce((acc, record) => record.win && acc + 1, 0) || 0
  const losses = array.length - wins;
  const averageRating = array.reduce((acc, record) => acc + record.rating, 0) / array.length

  return (
    <div className='App'>
      <div className='widget'>
        <h1>Chat Queue</h1>
        <h3>!Challenge {`{Chess.com name}`}</h3>
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ height: 440, backgroundColor: '#36454F', }} component={Paper} >
            <Table stickyHeader size="small" aria-label="a dense table" sx={{ backgroundColor: '#36454F' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF' }} align="center">Position</TableCell>
                  <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF'  }} align="center">Twitch</TableCell>
                  <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF' }} align="center">Chess.com</TableCell>
                  <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF' }} align="center">Status</TableCell>
                  <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF'  }} align="center"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data && query.data.map((row, index) => (
                  <TableRow
                    key={row.name}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF'  }} align="center">{index + 1}</TableCell>
                    <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF'  }} align="center">{row.twitchUser}</TableCell>
                    <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF'  }} align="center">{row.chessUser}</TableCell>
                    <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF' }} align="center">{row.status}</TableCell>
                    <TableCell sx={{ backgroundColor: '#36454F', color: '#FFF'  }} align="center">
                      <PlayArrow style={{cursor: 'pointer', margin: 2}} onClick={() => updateGame.mutate(row.id)}></PlayArrow>
                      <SaveAlt style={{cursor: 'pointer', margin: 2}} onClick={() => saveGame.mutate(row)}/>
                      <Delete style={{cursor: 'pointer', margin: 2}} onClick={() => deleteFromQueue.mutate(row.id)}/>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        <div>
          <h1>Current Stream Record</h1>
          <h3>Win: {wins} Losses: {losses}</h3>
          <h3>Average Chatter Rating: {parseInt(averageRating)} </h3>
        </div>
      </div>
    </div>
  )
}

export default App;
