FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    python3-pip


RUN apt-get install -y nodejs
RUN apt-get install -y npm

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Create a script file sourced by both interactive and non-interactive bash shells
ENV BASH_ENV ${HOME}/.bash_env
RUN touch "${BASH_ENV}"
RUN echo '. "${BASH_ENV}"' >> ~/.bashrc

# Download and install nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | PROFILE="${BASH_ENV}" bash
RUN echo node > .nvmrc

RUN nvm install 20
RUN nvm use 20

## install golang  and mage
RUN apt-get install -y golang-go
RUN go install github.com/magefile/mage@latest
RUN cp /root/go/bin/mage /usr/local/bin/mage

ENV GO111MODULE=on
ENV GOPROXY=https://proxy.golang.org