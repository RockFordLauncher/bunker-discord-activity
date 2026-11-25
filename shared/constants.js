// Shared constants between server and client

export const GAME_PHASES = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  VOTING: 'voting',
  ENDED: 'ended',
};

export const CARD_TYPES = {
  PROFESSION: 'profession',
  HEALTH: 'health',
  HOBBY: 'hobby',
  BAGGAGE: 'baggage',
  FACT: 'fact',
  BIOLOGY: 'biology',
  SPECIAL: 'special',
};

export const SPECIAL_ACTIONS = {
  IMMUNITY: 'immunity',       // Защита от изгнания на 1 раунд
  REVEAL: 'reveal',           // Принудительно раскрыть карту другого игрока
  SWAP: 'swap',               // Поменяться картой с другим игроком
  PEEK: 'peek',               // Посмотреть скрытую карту другого игрока (только тебе)
  SKIP_VOTE: 'skip_vote',     // Пропустить голосование этого раунда
  DOUBLE_VOTE: 'double_vote', // Два голоса в этом раунде
  REVIVE: 'revive',           // Вернуть изгнанного игрока
  POISON: 'poison',           // Добавить -1 голос целевому игроку (инвертировать)
};

export const SOCKET_EVENTS = {
  // Client → Server
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  START_GAME: 'start_game',
  REVEAL_CARD: 'reveal_card',
  VOTE: 'vote',
  USE_SPECIAL: 'use_special',
  CHAT_MESSAGE: 'chat_message',
  END_VOTING: 'end_voting',
  NEXT_ROUND: 'next_round',

  // Server → Client
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  ROOM_STATE: 'room_state',
  GAME_STARTED: 'game_started',
  CARD_REVEALED: 'card_revealed',
  VOTING_STARTED: 'voting_started',
  VOTE_CAST: 'vote_cast',
  VOTE_RESULT: 'vote_result',
  GAME_ENDED: 'game_ended',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  ERROR: 'error',
};

export const MAX_PLAYERS = 15;
export const MIN_PLAYERS = 2;
export const ROOM_CODE_LENGTH = 6;

// Win condition: survivors <= totalPlayers / 2
export const WIN_RATIO = 0.5;
