-- @block
CREATE TABLE Users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        );

-- @block
CREATE TABLE Posts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        createdDate TEXT,
        title VARCHAR(255) NOT NULL,
        genere VARCHAR(255) NOT NULL,
        creator VARCHAR(255) NOT NULL,
        video VARCHAR(255) NOT NULL,
        body TEXT,
        authorid INT,
        FOREIGN KEY (authorid) REFERENCES users (id)
        );

