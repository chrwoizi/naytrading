FROM ubuntu:22.04

# disable tzdata prompt
ENV TZ=Europe/Berlin
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# increase version to install security updates
RUN touch environment-v2

# install security updates
RUN apt update
RUN apt -y dist-upgrade
RUN apt update
RUN apt -y upgrade
RUN apt -y install unattended-upgrades

# install tools
RUN apt install -y sudo
RUN apt install -y cron
RUN apt install -y curl

# install nodejs
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
RUN apt install -y nodejs
RUN apt install -y build-essential
RUN npm i -g sequelize-cli

# install python 2.x for node-sass and gyp
RUN apt install -y python2

# create user
RUN useradd -ms /bin/bash naytrading
RUN echo naytrading:t4uqVrmGw7aJ6TVBxDUZwLLZGKrQvPDH | chpasswd
USER naytrading
WORKDIR /home/naytrading

# install miniconda
RUN curl -O https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
RUN bash Miniconda3-latest-Linux-x86_64.sh -b -p /home/naytrading/miniconda3
RUN rm Miniconda3-latest-Linux-x86_64.sh
ENV PATH="/home/naytrading/miniconda3/bin:${PATH}"

# increase version to restart deployment from here if new npm packages are needed
RUN touch dependendies-v2

# install python packages
RUN conda install -y -c conda-forge numpy
RUN conda install -y -c conda-forge noise

# install nodejs packages
WORKDIR /home/naytrading/builder
COPY --chown=naytrading:naytrading naytrading/client/package.json client/
COPY --chown=naytrading:naytrading naytrading/client/package-lock.json client/
COPY --chown=naytrading:naytrading naytrading/server/package.json server/
COPY --chown=naytrading:naytrading naytrading/server/package-lock.json server/
WORKDIR /home/naytrading/builder/client
RUN npm ci
WORKDIR /home/naytrading/builder/server
RUN npm ci

# copy sources
WORKDIR /home/naytrading/builder
COPY --chown=naytrading:naytrading naytrading/client ./client
COPY --chown=naytrading:naytrading naytrading/server ./server
COPY --chown=naytrading:naytrading naytrading-private/NAYtrading.Plugin ./server/plugins/plugin

# build
WORKDIR /home/naytrading/builder/client
RUN npm run build
WORKDIR /home/naytrading/builder/server
RUN npm run build

# configure
WORKDIR /home/naytrading/builder/server
ARG naytrading_database_host
ARG naytrading_database_username
ARG naytrading_database_password
RUN echo "{\"production\":{}}" > ./src/config/config.json
RUN echo "{\"production\":{\"username\":\"$naytrading_database_username\",\"password\":\"$naytrading_database_password\",\"database\":\"naytrading\",\"host\":\"$naytrading_database_host\",\"port\":3306,\"dialect\":\"mysql\",\"dialectOptions\":{\"decimalNumbers\":true,\"timezone\":\"+00:00\",\"dateStrings\":true},\"timezone\":\"+00:00\"}}" > ./src/config/database.json
ENV NODE_ENV=production

# deploy
WORKDIR /home/naytrading
RUN mv ./builder/server/dist ./server
RUN mv ./builder/server/node_modules ./server/
RUN mv ./builder/server/package.json ./server/
RUN mv ./builder/server/package-lock.json ./server/
RUN mv ./builder/server/start-docker.sh ./server/
RUN mkdir -p ./server/processing
RUN rm -rf ./builder

# run
WORKDIR /home/naytrading/server
EXPOSE 5000
CMD ["./start-docker.sh"]
