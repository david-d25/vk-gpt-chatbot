const phrases = [
    "Доброе утро, Москва!",
    "Татарам привет, остальным соболезную!",
    "Жители Воронежа, не паникуйте!",
    "Привет, котики мои хорошие!",
    "Привет, мои сладкие!",
    "Ну что, котики, аниме?",
    "И это ну шутка.",
    "Всем привет, остальным соболезную.",
    "Привет, булочки мои ржаные!",
    "Привет, хлебушки мои ржаные!",
    "Вот бы вас всех напоить квасом 'Царские Припасы'!",
    "Uwu, owo, nya, nya, nya!",
];

export function getRandomBotEnablingPhrase(): string {
    return "🟢 Бот включён. " + phrases[Math.floor(Math.random() * phrases.length)];
}