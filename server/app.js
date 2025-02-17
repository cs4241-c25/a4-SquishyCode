const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bodyParser = require("body-parser");
const GithubStrategy = require("passport-github").Strategy;
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require('path');

passport.use(new LocalStrategy(async (username, password, done) => {
    const user = await usersCollection.findOne({ username });
    if (!user) return done(null, false, { message: 'Invalid username' });
    if (user.password !== password) return done(null, false, { message: 'Invalid password' });
    return done(null, user);
}));

passport.use(new GithubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
    let user = await usersCollection.findOne({ githubId: profile.id });
    if (!user) {
        user = await usersCollection.insertOne({ githubId: profile.id, username: profile.username });
    }
    return done(null, user);
}));

passport.serializeUser((user, done) => {
    done(null, user._id);
});
passport.deserializeUser(async (id, done) => {
    const user = await usersCollection.findOne({ _id: new ObjectId(id) });
    done(null, user);
});

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, sameSite: 'lax' }
}));
app.use(passport.initialize());
app.use(passport.session());

const client = new MongoClient(process.env["MONGO_URI"]);
(async () => { try { await client.connect(); console.log("Connected to MongoDB Successfully!"); } catch (error) { console.error("MongoDB Connection Error:", error); process.exit(1); } })();

const db = client.db("A3-HomeworkDB");
const usersCollection = db.collection("users");
const dataCollection = db.collection("data");

const authRoutes = require("./routes/authRoutes");
app.use("/", authRoutes(usersCollection, dataCollection));

app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server is running on: http://localhost:${PORT}`); });
