define(['jsPDF', 'moment', 'chart1'] , function (jsPDF, moment) {

    var refresher;
    var gData;
    var defaultCarrier = window.defaultCarrier || 'SA';
    var $carrierGroups = $('#carrierGroups').clone();
    $carrierGroups.removeAttr('id');
    $carrierGroups.data('page', 'History');
    $('.groups-wrapper-history').html($carrierGroups);
    $('body').trigger('multiselect-ready', ['history']);

    var groupVarName = 'selectedGroupHistory';
    window[groupVarName] = window[groupVarName];

    $(function () {
        $('[data-toggle="tooltipoutbound"]').tooltip();
        $('[data-toggle="tooltipstartrange"]').tooltip();
        $('[data-toggle="tooltipendrange"]').tooltip();

        function getRandColor(brightness) {
            //6 levels of brightness from 0 to 5, 0 being the darkest
            var rgb = [Math.random() * 128, Math.random() * 256, Math.random() * 256];
            var mix = [brightness * 51, brightness * 51, brightness * 51]; //51 => 255/5
            var mixedrgb = [(Math.random() * 128) + rgb[0] + mix[0], rgb[1] + mix[1], rgb[2] + mix[2]].map(function (x) {
                return Math.round(x / 2.0);
            });

            return mixedrgb.join(",");
        }

        function randColors() {
            var mixedrgb = getRandColor(0);
            return ["rgb(" + mixedrgb + ")", "rgba(" + mixedrgb + ",0.2)", "rgba(" + mixedrgb + ", 1)"];
        }

        var canvas = document.getElementById("history-QbyS");
        var ctx = canvas.getContext("2d");
        var faresChart;

        var canvasNegative = $('#history-negative-block').find('canvas')[0];
        var ctxNegative = canvasNegative.getContext("2d");
        var chartNegative;

        var canvasPositive = $('#history-positive-block').find('canvas')[0];
        var ctxPositive = canvasPositive.getContext("2d");
        var chartPositive;

        var $loader = $('#history-loading');
        var $preloader = $('#history-placeholder');
        var $legend = $('#history-graph-legend');
        var $dowloadLinks = $('#history-download-links');
        var $diffBlock = $('#history-diff-block');

        var $reportsBlock = $('#history-report-block');
        var $negativeBlock = $('#history-negative-block');
        var $positiveBlock = $('#history-positive-block');

        var datasets;
        var chartData;
        var chartConfig = {
            animation: false,
            barShowStroke: false,
            tooltipTitleFontFamily: "'Titillium Web',sans-serif",
            tooltipFontStyle: "600",
            tooltipFontFamily: "'Titillium Web',sans-serif",
            tooltipTitleFontStyle: "600",
            scaleFontFamily: "'Titillium Web',sans-serif",
            scaleFontStyle: "700",
            responsive: true,
            maintainAspectRatio: true,
            tooltipFillColor: "rgba(0,0,0,0.8)",
            multiTooltipTemplate: "<%= datasetLabel %> - <%= value %>"
        };

        var profitOptions = '';
        for(var i=1; i<=50; i++){
            profitOptions += '<option value="' + i + '">' + i + '</option>'
        }
        $('#profitMultiplierHistory').html(profitOptions);

        window.globalDataHistory = {labels:[], data:[], fLabels:[]};

        var formatDate = function (date) {
            var month = date.getMonth() + 1;
            if (month < 10) {
                month = '0' + month;
            }

            var day = date.getDate();
            if (day < 10) {
                day = '0' + day;
            }

            return date.getFullYear() + '-' + month + "-" + day;
        };

        var transform = function (airlineData) {
            for (var key in airlineData) {
                airlineData[key] = airlineData[key].value;
            }
            return airlineData;
        };

        var valuesOf = function (object) {
            var values = [];
            for (var key in object) {
                values.push(object[key]);
            }
            return values;
        };

        function getVals(obj){
            var values = [];
            for(var i in obj){ values.push(obj[i]); }
            return values;
        }
        function getVals2(obj){
            var values = [];
            for(var i in obj){
                var val = obj[i].value ? obj[i].value : 0;
                values.push(val);
            }
            return values;
        }

        function reportTimer() {
            buildReport(null);
        }

        function initReportTimer() {
            clearInterval(refresher);
        }

        initReportTimer();
        $('body').on('click', '#history .build-report', function (e, eventData) {
            e.preventDefault();
            e.stopPropagation();

            buildReport(eventData);
            initReportTimer();
            refresher = setInterval(function(){ reportTimer() }, 60000);
        });

        function buildReport(eventData){

            var sd, ed, od, from, to, minThreshold, maxThreshold;
            if(eventData){
                var searchParams = window.searchParams.queryHistory.split('/');
                from = searchParams[0];
                to = searchParams[1];
                od = searchParams[2];
                sd = searchParams[4];
                ed = searchParams[5];

                $('#history-range-start-date').val(sd);
                $('#history-range-end-date').val(ed);
                $('#history-outbound-date').val(od);
                $('#history-origin').val(from);
                $('#history-destination').val(to);
            } else {
                sd = $('#history-range-start-date').val();
                ed = $('#history-range-end-date').val();
                od = $('#history-outbound-date').val();
                from = $('#history-origin').val();
                to = $('#history-destination').val();

                maxThreshold = $('#historyThresholdMax').val();
                minThreshold = $('#historyThresholdMin').val();
            }

            $('.errorBlock').html('');
            $('#history-origin').parents('.form-inline').find('.form-group').removeClass('has-warning has-feedback');
            if (typeof sd === 'undefined') {
                showAlert('Start date is required!');
                $('#history-range-start-date').parents('.form-group').addClass('has-warning has-feedback');
                return false;
            }

            if (typeof ed === 'undefined') {
                showAlert('End date is required!');
                $('#history-range-end-date').parents('.form-group').addClass('has-warning has-feedback');
                return false;
            }

            if (typeof od === 'undefined') {
                showAlert('Outbound date is required!');
                $('#history-outbound-date').parents('.form-group').addClass('has-warning has-feedback');
                return false;
            }

            if (typeof from === 'undefined' || $.trim(from).length === 0) {
                showAlert('Origin is required!');
                $('#history-origin').parents('.form-group').addClass('has-warning has-feedback');
                return false;
            }

            if (typeof to === 'undefined' || $.trim(to).length === 0) {
                showAlert('Destination is required!');
                $('#history-destination').parents('.form-group').addClass('has-warning has-feedback');
                return false;
            }

            var startDate = new Date(Date.parse(sd));
            var endDate = new Date(Date.parse(ed));
            var outboundDate = new Date(Date.parse(od));

            // //api1.webjet.com/lowest-fare-api/airdata/history/BOS/BOM/2015-12-31/period/2015-10-17/2015-10-20
            var searchString = from + '/' + to + '/' + formatDate(outboundDate)
                + '/period/' + formatDate(startDate) + '/' + formatDate(endDate);
            window.searchParams.queryHistory = searchString;
            location.hash = window.searchParams.pageUrl + '/' + searchString;
            var endpoint = '//api1.webjet.com/metashopper/rs/airdata/history/' + searchString;

            if($('#history .save').prop('checked')){
                $('#history .save').prop('checked', false);
                var saveData = {
                    sd: sd,
                    ed: ed,
                    from: from,
                    to: to,
                    od: od,
                    url: endpoint,
                    maxThreshold: maxThreshold ? maxThreshold : null,
                    minThreshold: minThreshold ? minThreshold : null,
                    show: false,
                    fullwidth: true,
                    type: 'history',
                    time: moment().format('YYYY-MM-DD, h:mm:ss a')
                };
                saveSearch(saveData);
            }

            var $link = $('.main-nav a.active');
            var hrefOfLink = $link.attr('href');
            hrefOfLink = hrefOfLink.indexOf('#') == -1 ? hrefOfLink : hrefOfLink.substr(0, hrefOfLink.indexOf('#'));
            $link.attr('href', hrefOfLink + location.hash );

            $preloader.show(0);
            $loader.show(0);
            $legend.hide(0);
            $dowloadLinks.hide(0);
            $diffBlock.hide(0);
            $reportsBlock.hide(0);
            $negativeBlock.hide(0);
            $positiveBlock.hide(0);

            var token = JSON.parse(localStorage.getItem('auth')) || {};
            if(token['token']){
                token = token['token']
            } else {
                token = ''
            }
            jQuery.ajax({
                url: endpoint,
                method: 'GET',
                dataType: 'json',
                headers: {
                    'X-MSOTA-SESSION': token,
                    'Content-Type': 'application/json'
                },
                success: function (d) {

                    $preloader.hide(0);
                    $loader.hide(0);
                    $legend.show();
                    $dowloadLinks.show();

                    gData = d;
                    showCharts(d.data, d.labels);
                },
                error: function (error) {
                    if(error.status == 401){
                        localStorage.removeItem('auth');
                        location.pathname = '/login'
                    }
                    console.warn(error);
                }
            });
        }

        function showCharts(dData, dLabels){
            var d = {};
            d.data = dData;
            d.labels = dLabels;
            //clear data
            if(window[groupVarName] && window[groupVarName].indexOf('all') === -1){
                var newData = {};
                for(var i in d.data){
                    if(window[groupVarName].indexOf(i) !== -1){
                        newData[i] = d.data[i];
                    }
                }
                //replace original data
                d.data = newData;
            }

            var labels = d.labels;
            var airlines = Object.keys(d.data);
            var tmp = airlines.splice(airlines.indexOf(window.defaultCarrier), 1);
            airlines.splice(0, 0, tmp[0]);

            //set this data gloabaly for get csv
            window.globalDataHistory.labels = labels;
            window.globalDataHistory.data = d.data;

            //think do it before or after CVS???
            //think maybe needed clone or copy for this data
            for(var i in d.data){
                var vals = getVals2(d.data[i]);
                var sum = vals.reduce(function(pv, cv) {
                    return pv + cv;
                }, 0);
                if(!sum){
                    delete d.data[i]; //unset air line with all clear rows
                }
            }

            if(!Object.keys(d.data).length){
                console.log('empty data');
                return false;
            }

            datasets = [];

            var token = JSON.parse(localStorage.getItem('auth')) || {};
            var defaultCarrierColor = token.defaultCarrierColor;

            window.globalDataHistory.fLabels = labels;
            var tableHead = '<th></th><th>' + labels.join('</th><th>') + '</th>';
            var tableBody = '';
            airlines.forEach(function(airline){
                var colors;
                if(!d.data.hasOwnProperty(airline)){ return true; }
                if(airline.toUpperCase() == window.defaultCarrier){
                    // colors = ['rgb(0, 0, 0)', 'rgba(0, 0, 0, 0.5)', 'rgb(0, 0, 0)'];
                    colors = [defaultCarrierColor, defaultCarrierColor, defaultCarrierColor];
                } else {
                    colors = randColors();
                }


                var data = [];
                for (var i = 0; i < labels.length; i++) {
                    var val = d.data[airline][labels[i]].value;
                    val = val || null;
                    data.push(val);
                }

                datasets.push({
                    label: airline,
                    data: data,
                    // fillColor: colors[1],
                    fillColor: 'rgba(0,0,0,0)',
                    strokeColor: colors[0],
                    pointStrokeColor: "#fff",
                    pointHighlightFill: "#fff",
                    pointHighlightStroke: colors[2],
                    pointColor: colors[2]
                });

                var tableString = data.map(function(n, i){
                    return '<td data-th="' + airline + ' ' + labels[i] + '">' + (n || '') + '</td>'
                });
                tableBody += '<tr>';
                tableBody += '<th>'
                    + ((airline.toUpperCase() != window.defaultCarrier)
                        ? '<span class="glyphicon glyphicon-remove-circle remove-airline" data-airline="'
                        + airline.toUpperCase() + '"></span>' : '&nbsp;&nbsp;')
                    + airline + '</th>'
                    + tableString.join();
                tableBody += '</tr>';
            });

            chartData = {
                labels: labels,
                datasets: datasets
            };

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (faresChart)
            {
                faresChart.destroy();
            }

            faresChart = new Chart(ctx).Line(chartData, chartConfig);

            $reportsBlock.find('thead tr').html(tableHead);
            $reportsBlock.find('tbody').html(tableBody);
            $reportsBlock.show();

            $('#history-graph-legend').html(faresChart.generateLegend());

            generatePriceDiffSABarChart(d.data);
        }

        var positiveByDay = {};
        var negativeByDay = {};
        var p;
        function generatePriceDiffSABarChart(data){
            negativeByDay = {};
            positiveByDay = {};

            //$('#history-diff-block').show(0); it not showing now needed remove data
            if(typeof data[defaultCarrier] == 'undefined' || !Object.keys(data[defaultCarrier]).length){
                console.warn('no data');
                return false;
            }

            var main = data[defaultCarrier];
            var d = {};
            for(var i in main){
                if(main[i].value){
                    d[i] = main[i].value;
                }
            }

            if(!Object.keys(d).length){
                console.warn('all flights are empty');
                return false;
            }

            var labels = Object.keys(d); //need order them in
            var comparisonDataUpper = {};

            for(var airline in data){
                if(airline == defaultCarrier){ continue; }
                var item = data[airline];
                var rowUpper = [];
                for(var j in labels){
                    var label = labels[j];
                    if(!item[label].value){
                        rowUpper.push(null);
                    } else {
                        var diff = Math.round(item[label].value - d[label]);
                        rowUpper.push(diff);
                        //first iteration = first day
                        if(diff > 0) { //maybe check on zero
                            if(typeof positiveByDay[label] == 'undefined'){
                                positiveByDay[label] = {};
                            }
                            if(typeof positiveByDay[label][airline] == 'undefined'){
                                positiveByDay[label][airline] = {};
                            }
                            positiveByDay[label][airline] = diff;
                        } else {
                            if(typeof negativeByDay[label] == 'undefined'){
                                negativeByDay[label] = {};
                            }
                            if(typeof negativeByDay[label][airline] == 'undefined'){
                                negativeByDay[label][airline] = {};
                            }
                            negativeByDay[label][airline] = diff;
                        }
                    }
                }
                comparisonDataUpper[airline] = rowUpper;
            }


            var colors;
            var $selector;

            //------------------------------------------------------------------------------------------------------
            showProfitDifferential(1);

            //------------------------------------------------------------------------------------------------------
            var n = {};
            var nd = [];
            var nl = [];
            for(var i in window.globalDataHistory.fLabels){
                var day = window.globalDataHistory.fLabels[i];
                if(typeof negativeByDay[day] === 'undefined'){
                    if(typeof p[day] === 'undefined'){
                        continue;
                    }
                    nd.push(p[day]); //populate positive
                    nl.push(day);
                    continue;
                }
                nl.push(day);
                var item = negativeByDay[day];
                var min = 0;
                for(var company in item){
                    if(!min || item[company] < min){
                        min = item[company];
                    }
                }
                n[day] = min;
                nd.push(min);
            }
            if(nd.length){
                $selector = $('#history-negative-block');
                datasets = [];
                colors = randColors();
                datasets.push({
                    //label: firstKey,
                    data: nd,
                    fillColor: colors[2],
                    strokeColor: colors[0],
                    highlightFill: colors[0],
                    highlightStroke: colors[0]
                });

                chartData = {
                    labels: nl,
                    datasets: datasets
                };
                $selector.show(0);
                ctxNegative.clearRect(0, 0, canvasNegative.width, canvasNegative.height);
                if (chartNegative){ chartNegative.destroy(); }
                chartNegative = new Chart(ctxNegative).Bar(chartData, $.extend({scaleBeginAtZero: false}, chartConfig));

                var html = nd.map(function(n, i){
                    return '<td data-th="' + nl[i] + '">' + (n || 0) + '</td>'
                }).join();
                $selector.find('thead tr').html('<th>' + nl.join('</th><th>') + '</th>');
                $selector.find('tbody tr').html(html);
            }
        }

        function showProfitDifferential(multiplier) {
            p = {};
            var pd = [];
            var pl = [];
            for (var i in window.globalDataHistory.fLabels) {
                var day = window.globalDataHistory.fLabels[i];
                if (typeof positiveByDay[day] === 'undefined') {
                    continue;
                }
                pl.push(day);
                var item = positiveByDay[day];

                var min = 0;

                for (var company in item) {
                    if (!min || item[company] < min) {
                        min = item[company];
                    }
                }

                if (negativeByDay[day]) {
                    p[day] = 0;
                    pd.push(0);
                } else {
                    min *= multiplier;
                    p[day] = min;
                    pd.push(min);
                }
            }
            if (pd.length) {
                $selector = $('#history-positive-block');
                var sum = pd.reduce(
                    function (pv, cv)
                    {
                        return pv + cv;
                    }, 0);
                datasets = [];
                colors = randColors();
                datasets.push(
                    {
                        //label: 'g', //how to show label [null, val, null, null]
                        data: pd,
                        fillColor: colors[2],
                        strokeColor: colors[0],
                        highlightFill: colors[0],
                        highlightStroke: colors[0]
                    });

                chartData = {
                    labels: pl, //check of correct order
                    datasets: datasets
                };
                $selector.show(0);
                ctxPositive.clearRect(0, 0, canvasPositive.width, canvasPositive.height);
                if (chartPositive) {
                    chartPositive.destroy();
                }
                chartPositive = new Chart(ctxPositive).Bar(chartData, $.extend({scaleBeginAtZero: false}, chartConfig));

                var html = pd.map(function(n, i){
                    return '<td data-th="' + pl[i] + '">' + (n || 0) + '</td>'
                }).join();
                $selector.find('thead tr').html('<th>' + pl.join('</th><th>') + '</th><th>Revenue by Range</th><th>Annual Projected Revenue</th>');
                $selector.find('tbody tr').html(html + '<td class="width-item" data-th="Revenue by Range">'
                    + sum + '</td><td class="width-item" data-th="Annual Projected Revenue">'
                    + parseFloat((sum / pd.length) * 365).toFixed(2) + '</td>');
            }
        }

        var $body = $('body');
        var doc = new jsPDF('p','mm','a4');

        var $outbound = $body.find('#history-outbound-date');
        var today = moment();
        $outbound.val(today.format('YYYY-MM-DD'));
        $('#outboundDate').daterangepicker({
            autoApply: true,
            singleDatePicker: true,
            startDate: today.format('L')
        }, function(start, end, label) {
            $outbound.val(start.format('YYYY-MM-DD'));
        });

        var $startRange = $body.find('#history-range-start-date');
        var $endRange = $body.find('#history-range-end-date');
        var startDate, endDate;
        if(window.searchParams.queryHistory){
            var parts = window.searchParams.queryHistory.split('/');
            $startRange.val(parts[4]);
            $endRange.val(parts[5]);
            startDate = moment(parts[4]);
            endDate = moment(parts[5])
        } else {
            startDate = moment().startOf('month');
            endDate = moment().endOf('month');
            $startRange.val(startDate.format('YYYY-MM-DD'));
            $endRange.val(endDate.format('YYYY-MM-DD'));
        }

        $('#historyRange').daterangepicker({
            autoApply: true,
            startDate: startDate.format('L'),
            endDate: endDate.format('L')
        }, function(start, end, label) {
            $startRange.val(start.format('YYYY-MM-DD'));
            $endRange.val(end.format('YYYY-MM-DD'));
        });

        $body.on('change', '#profitMultiplierHistory', function(){
            var val = $(this).val();
            showProfitDifferential(val);
            if(val == 1){
                val = '';
            } else {
                val = '(x' + val + ')';
            }
            $(this).parents('.panel-heading').find('.multiplier').html(val);
        });

        $body.on('click', '#history-download-pdf', function () {
            var $content = $('.history-exported-content');//.clone();
            $content.css({padding: '30px'});
            var $downloadLinks = $content.find('#history-download-links');
            $downloadLinks.hide(0);

            var $tables = $('#history').find('table');
            $tables.each(function(i, item){
                if($(this).width() > $(this).parents('.panel').width()){
                    $(this).parents('.table-responsive').addClass('reformat');
                }
            });
            //return false;

            doc.addHTML($content.get(0), function() {
                doc.addPage();
                doc.addHTML($content.get(1), function() {
                    doc.save(generateName() +  '.pdf');
                    $content.css({padding: '0'});
                    $downloadLinks.show(0);
                    $('#history').find('.reformat').removeClass('reformat');
                });
            });
        });

        $body.on('click', '#history-download-csv', function () {

            function getValues(data, source){
                var values = [];
                source.forEach(function(key) {
                    if(data.hasOwnProperty(key)){
                        values.push(data[key].value);
                    } else {
                        values.push(null);
                    }
                });
                return values;
            }

            var labels = globalDataHistory.labels;
            var csvContent = "data:text/csv;charset=utf-8,";
            csvContent += 'Airlines Reference,' + labels.join(",") + "\n";

            var len = Object.keys(globalDataHistory.data).length;
            var cnt = 0;
            for(var i in globalDataHistory.data){
                cnt++;
                var item = getValues(globalDataHistory.data[i], labels);
                var dataString = i + ',' + item.join(",");
                csvContent += cnt < len ? dataString + "\n" : dataString;
            }

            var encodedUri = encodeURI(csvContent);
            //window.open(encodedUri);
            var link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", generateName() + ".csv");

            link.click();
        });

        $body.on(groupVarName, function () {
            if(gData){
                showCharts(gData.data, gData.labels);
            }
        });

        function generateName(){
            return 'airdatadb-history-' + $('#history-origin').val() + '-' + $('#history-destination').val() + '-'
                    + getDate($('#history-range-start-date').val()) + '-' + getDate($('#history-range-end-date').val())
        }

        function getDate(date){
            date = new Date(date);
            var day = '' + date.getDate();
            var monthIndex = '' + (date.getMonth() + 1);
            var year = date.getFullYear();

            return (monthIndex.length < 2 ? '0' + monthIndex : monthIndex) + '-'
                + (day.length < 2 ? '0' + day : day) + '-' + year;
        }

    });

    if(window.searchParams.queryHistory){
        $('#history .build-report').first().trigger('click', [true]);
    }

});
